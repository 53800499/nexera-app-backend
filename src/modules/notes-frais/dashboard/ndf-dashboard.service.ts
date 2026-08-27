import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class NdfDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Dépenses du mois
    const depensesMois = await this.prisma.ndfDepense.findMany({
      where: {
        tenantId,
        dateDepense: { gte: startOfMonth, lte: endOfMonth },
        isDeleted: false,
      },
      include: { categorieDepense: true },
    });

    const totalDepensesMoisEnCours = depensesMois.reduce(
      (acc, d) => acc + d.montantDeviseReference,
      0,
    );

    // 2. Rapports en attente de validation
    const nombreRapportsEnAttenteValidation = await this.prisma.ndfRapportFrais.count({
      where: {
        tenantId,
        statut: { in: ['EN_VALIDATION', 'SOUMIS'] },
        isDeleted: false,
      },
    });

    // 3. Montant en attente de remboursement
    const remboursementsEnAttente = await this.prisma.ndfRemboursement.findMany({
      where: { tenantId, statut: 'A_PAYER', isDeleted: false },
    });
    const montantEnAttenteRemboursement = remboursementsEnAttente.reduce(
      (acc, r) => acc + r.montant,
      0,
    );

    // 4. Nombre d'anomalies détectées non traitées
    const nombreAnomaliesDetectees = await this.prisma.ndfAnomalieDetectee.count({
      where: { tenantId, statut: 'DETECTEE', isDeleted: false },
    });

    // 5. Répartition par catégorie
    const catMap = new Map<string, number>();
    for (const d of depensesMois) {
      const catLibelle = d.categorieDepense.libelle;
      catMap.set(catLibelle, (catMap.get(catLibelle) || 0) + d.montantDeviseReference);
    }

    const repartitionParCategorie = Array.from(catMap.entries()).map(([categorie, montant]) => ({
      categorie,
      montant: Math.round(montant * 100) / 100,
      pourcentage:
        totalDepensesMoisEnCours > 0
          ? Math.round((montant / totalDepensesMoisEnCours) * 1000) / 10
          : 0,
    }));

    // 6. 5 Dernières dépenses saisies
    const dernieresDepenses = await this.prisma.ndfDepense.findMany({
      where: { tenantId, isDeleted: false },
      include: {
        categorieDepense: true,
        rapportFrais: {
          include: {
            employe: {
              select: {
                id: true,
                nom: true,
                prenoms: true,
                matricule: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      totalDepensesMoisEnCours: Math.round(totalDepensesMoisEnCours * 100) / 100,
      nombreRapportsEnAttenteValidation,
      montantEnAttenteRemboursement: Math.round(montantEnAttenteRemboursement * 100) / 100,
      nombreAnomaliesDetectees,
      repartitionParCategorie,
      dernieresDepenses,
    };
  }
}
