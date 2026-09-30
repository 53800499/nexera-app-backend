import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class CalendrierFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async getEcheances(taxContribuableId: string, statut?: string) {
    const echeances = await (this.prisma as any).taxEcheance.findMany({
      where: {
        taxContribuableId,
        ...(statut ? { statut } : {}),
      },
      include: {
        taxType: true,
        alertes: true,
        penalites: true,
      },
      orderBy: { dateLimite: 'asc' },
    });

    const now = new Date();

    // Vérifier les retards et calculer dynamiquement l'estimation des pénalités CGI 2026 (EF-033)
    return echeances.map((ech: any) => {
      const isEnRetard = ech.statut === 'A_VENIR' && new Date(ech.dateLimite) < now;
      let penaliteEstimee = 0;

      if (isEnRetard && ech.montantEstime) {
        // CGI Bénin 2026 : 10% pour retard de paiement + 0.25%/mois d'intérêt de retard
        const diffTime = Math.abs(now.getTime() - new Date(ech.dateLimite).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.max(1, Math.ceil(diffDays / 30));

        const penaliteRetardPaiement = ech.montantEstime * 0.1; // 10%
        const interetRetard = ech.montantEstime * (diffMonths * 0.0025); // 0.25% par mois
        penaliteEstimee = Math.round((penaliteRetardPaiement + interetRetard) * 100) / 100;
      }

      return {
        ...ech,
        statutCalcul: isEnRetard ? 'EN_RETARD' : ech.statut,
        penaliteEstimee,
        montantTotalAvecPenalite: (ech.montantEstime || 0) + penaliteEstimee,
      };
    });
  }

  async synchroniserEcheancesAutomatiques(taxContribuableId: string) {
    const contribuable = await (this.prisma as any).taxContribuable.findUnique({
      where: { id: taxContribuableId },
      include: { pays: true },
    });
    if (!contribuable) {
      throw new NotFoundException('Contribuable introuvable.');
    }

    const types = await (this.prisma as any).taxType.findMany({
      where: { paysCode: contribuable.paysCode, actif: true },
      include: { calendriersTypes: true },
    });

    const now = new Date();
    const currentYear = now.getFullYear();

    for (const t of types) {
      // Pour chaque type d'impôt avec calendrier récurrent, vérifier la présence des échéances
      if (t.code === 'TVA' && contribuable.assujettiTva) {
        // Générer les échéances mensuelles TVA (10 de chaque mois)
        for (let m = 1; m <= 12; m++) {
          const dateLimite = new Date(`${currentYear}-${String(m).padStart(2, '0')}-10`);
          const periode = `${m === 1 ? currentYear - 1 : currentYear}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;

          await (this.prisma as any).taxEcheance.upsert({
            where: {
              id: `echeance-tva-${taxContribuableId}-${currentYear}-${m}`,
            },
            update: {},
            create: {
              id: `echeance-tva-${taxContribuableId}-${currentYear}-${m}`,
              taxContribuableId,
              taxTypeId: t.id,
              objetLieType: 'tax_declaration_tva',
              dateLimite,
              montantEstime: 0,
              statut: dateLimite < now ? 'EN_RETARD' : 'A_VENIR',
            },
          });
        }
      }

      if (t.code === 'IS' && contribuable.assujettiIs) {
        const datesIs = [
          { d: `${currentYear}-03-10`, label: '1er acompte trimestriel IS' },
          { d: `${currentYear}-04-30`, label: 'Déclaration annuelle & Solde IS' },
          { d: `${currentYear}-06-10`, label: '2ème acompte trimestriel IS' },
          { d: `${currentYear}-09-10`, label: '3ème acompte trimestriel IS' },
          { d: `${currentYear}-12-10`, label: '4ème acompte trimestriel IS' },
        ];

        for (let idx = 0; idx < datesIs.length; idx++) {
          const item = datesIs[idx];
          const dateLimite = new Date(item.d);
          await (this.prisma as any).taxEcheance.upsert({
            where: {
              id: `echeance-is-${taxContribuableId}-${currentYear}-${idx}`,
            },
            update: {},
            create: {
              id: `echeance-is-${taxContribuableId}-${currentYear}-${idx}`,
              taxContribuableId,
              taxTypeId: t.id,
              objetLieType: 'tax_acompte_is',
              dateLimite,
              montantEstime: 0,
              statut: dateLimite < now ? 'EN_RETARD' : 'A_VENIR',
            },
          });
        }
      }

      if (t.code === 'PATENTE') {
        const dateLimite = new Date(`${currentYear}-04-30`);
        await (this.prisma as any).taxEcheance.upsert({
          where: {
            id: `echeance-patente-${taxContribuableId}-${currentYear}`,
          },
          update: {},
          create: {
            id: `echeance-patente-${taxContribuableId}-${currentYear}`,
            taxContribuableId,
            taxTypeId: t.id,
            objetLieType: 'tax_declaration_generique',
            dateLimite,
            montantEstime: 70000,
            statut: dateLimite < now ? 'EN_RETARD' : 'A_VENIR',
          },
        });
      }
    }

    return this.getEcheances(taxContribuableId);
  }

  async marquerEcheancePayee(echeanceId: string) {
    return (this.prisma as any).taxEcheance.update({
      where: { id: echeanceId },
      data: { statut: 'PAYEE' },
    });
  }

  async creerAlerte(echeanceId: string, delaiJours: number, userId: string, canal: 'APPLICATION' | 'EMAIL' | 'SMS' = 'APPLICATION') {
    return (this.prisma as any).taxAlerteEcheance.create({
      data: {
        taxEcheanceId: echeanceId,
        delaiJours,
        destinataireUtilisateurId: userId,
        canal,
        statut: 'PLANIFIEE',
      },
    });
  }
}
