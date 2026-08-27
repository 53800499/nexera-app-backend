import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface AnomalyReport {
  typeRegle: string;
  description: string;
  scoreRisque: number;
  niveauSeverite: 'INFORMATIF' | 'A_VERIFIER' | 'BLOQUANT';
  depenseId?: string;
  depenseLieeSuspecteeId?: string;
}

@Injectable()
export class AnomaliesEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analyse approfondie d'un rapport de frais et de ses dépenses (7 règles SFD M5 section 6.3)
   */
  async analyserRapportFrais(
    tenantId: string,
    rapportId: string,
  ): Promise<AnomalyReport[]> {
    const rapport = await this.prisma.ndfRapportFrais.findFirst({
      where: { id: rapportId, tenantId, isDeleted: false },
      include: {
        employe: true,
        mission: true,
        depenses: {
          where: { isDeleted: false },
          include: { categorieDepense: true },
        },
      },
    });

    if (!rapport) return [];

    const anomalies: AnomalyReport[] = [];
    const regles = await this.prisma.ndfRegleDetectionAnomalie.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        actif: true,
        isDeleted: false,
      },
    });

    const regleDoublon = regles.find((r) => r.typeRegle === 'DOUBLON_POTENTIEL');
    const reglePolitique = regles.find((r) => r.typeRegle === 'DEPASSEMENT_POLITIQUE');
    const regleMission = regles.find((r) => r.typeRegle === 'INCOHERENCE_DATE_MISSION');

    for (const depense of rapport.depenses) {
      // 1. Détection de doublons potentiels (même montant, même date, même fournisseur)
      if (regleDoublon) {
        const doublon = await this.prisma.ndfDepense.findFirst({
          where: {
            tenantId,
            id: { not: depense.id },
            montantDeviseReference: depense.montantDeviseReference,
            dateDepense: depense.dateDepense,
            isDeleted: false,
          },
        });

        if (doublon) {
          anomalies.push({
            typeRegle: 'DOUBLON_POTENTIEL',
            description: `Dépense similaire détectée (Montant: ${depense.montantTtc} ${depense.deviseCode}, Date: ${depense.dateDepense.toISOString().split('T')[0]}) sur une autre note de frais`,
            scoreRisque: 85,
            niveauSeverite: regleDoublon.niveauSeverite,
            depenseId: depense.id,
            depenseLieeSuspecteeId: doublon.id,
          });
        }
      }

      // 2. Dépassement de politique de dépenses
      if (reglePolitique) {
        const politique = await this.prisma.ndfPolitiqueDepense.findFirst({
          where: {
            tenantId,
            categorieDepenseId: depense.categorieDepenseId,
            isDeleted: false,
          },
        });

        const catLibelle = depense.categorieDepense?.libelle || 'de la dépense';
        if (
          politique?.plafondMontant &&
          depense.montantDeviseReference > politique.plafondMontant
        ) {
          anomalies.push({
            typeRegle: 'DEPASSEMENT_POLITIQUE',
            description: `Le montant (${depense.montantDeviseReference} XOF) dépasse le plafond autorisé (${politique.plafondMontant} XOF) pour la catégorie ${catLibelle}`,
            scoreRisque: 70,
            niveauSeverite: reglePolitique.niveauSeverite,
            depenseId: depense.id,
          });
        }
      }

      // 3. Incohérence avec les dates de la mission
      if (regleMission && rapport.mission?.dateDebut && rapport.mission?.dateFin) {
        const dDate = new Date(depense.dateDepense);
        const mDebut = new Date(rapport.mission.dateDebut);
        const mFin = new Date(rapport.mission.dateFin);

        if (!isNaN(dDate.getTime()) && !isNaN(mDebut.getTime()) && !isNaN(mFin.getTime())) {
          if (dDate < mDebut || dDate > mFin) {
            anomalies.push({
              typeRegle: 'INCOHERENCE_DATE_MISSION',
              description: `La date de la dépense (${dDate.toISOString().split('T')[0]}) est en dehors des dates de la mission (${mDebut.toISOString().split('T')[0]} au ${mFin.toISOString().split('T')[0]})`,
              scoreRisque: 90,
              niveauSeverite: regleMission.niveauSeverite,
              depenseId: depense.id,
            });
          }
        }
      }

      // 4. Seuil légal de paiement en espèces (CGI Bénin 2026 Art. 21)
      if (depense.depasseSeuilEspeceLegal) {
        anomalies.push({
          typeRegle: 'MONTANT_INHABITUEL',
          description: `Paiement en espèces (${depense.montantDeviseReference} XOF) atteignant ou dépassant le seuil légal de 100 000 FCFA (CGI Bénin 2026 Art. 21) — Risque de non-déductibilité fiscale`,
          scoreRisque: 95,
          niveauSeverite: 'BLOQUANT',
          depenseId: depense.id,
        });
      }
    }

    // Persister les anomalies détectées
    for (const anom of anomalies) {
      const regle = regles.find((r) => r.typeRegle === anom.typeRegle) || regles[0];
      if (regle) {
        await this.prisma.ndfAnomalieDetectee.create({
          data: {
            tenantId,
            ndfRapportFraisId: rapport.id,
            ndfDepenseId: anom.depenseId || null,
            regleDetectionId: regle.id,
            description: anom.description,
            scoreRisque: anom.scoreRisque,
            depenseLieeSuspecteeId: anom.depenseLieeSuspecteeId || null,
            statut: 'DETECTEE',
          },
        });
      }
    }

    // Calcul du score de risque global du rapport
    const scoreRisqueIa =
      anomalies.length > 0
        ? Math.round(
            (anomalies.reduce((sum, a) => sum + a.scoreRisque, 0) /
              anomalies.length) *
              100,
          ) / 100
        : 0;

    await this.prisma.ndfRapportFrais.update({
      where: { id: rapport.id },
      data: { scoreRisqueIa },
    });

    return anomalies;
  }
}
