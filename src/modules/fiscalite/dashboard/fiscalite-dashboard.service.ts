import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class FiscaliteDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKpis(tenantId: string) {
    const contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId, isDeleted: false },
      include: {
        pays: true,
        regimeImposition: true,
      },
    });

    if (!contribuable) {
      return {
        hasContribuable: false,
        kpis: {
          tvaNetteMois: 0,
          isEstime: 0,
          acomptesIsVerses: 0,
          acomptesIsRestants: 0,
          sourcesEnAttenteQualification: 0,
          prochainesEcheancesCount: 0,
          controlesEnCoursCount: 0,
          tauxEffectifEstime: 0,
        },
        prochainesEcheances: [],
        sourcesRecentes: [],
      };
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. TVA du mois courant ou précédent
    const declarationTva = await (this.prisma as any).taxDeclarationTva.findFirst({
      where: { taxContribuableId: contribuable.id },
      orderBy: { periode: 'desc' },
    });

    // 2. Dernier calcul d'IS
    const dernierCalculIs = await (this.prisma as any).taxCalculIs.findFirst({
      where: {
        exerciceFiscal: { taxContribuableId: contribuable.id },
      },
      include: { exerciceFiscal: true },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Prochaines échéances dans les 30 jours
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const prochainesEcheances = await (this.prisma as any).taxEcheance.findMany({
      where: {
        taxContribuableId: contribuable.id,
        dateLimite: { gte: now, lte: in30Days },
        statut: { in: ['A_VENIR', 'EN_RETARD'] },
      },
      include: { taxType: true },
      orderBy: { dateLimite: 'asc' },
      take: 5,
    });

    // 4. Sources en attente de qualification (EF-011)
    const sourcesEnAttente = await (this.prisma as any).taxSourceReglementaire.count({
      where: {
        paysCode: contribuable.paysCode,
        statutVeille: { in: ['A_QUALIFIER', 'QUALIFIEE'] },
        isDeleted: false,
      },
    });

    const sourcesRecentes = await (this.prisma as any).taxSourceReglementaire.findMany({
      where: {
        paysCode: contribuable.paysCode,
        isDeleted: false,
      },
      orderBy: { datePublication: 'desc' },
      take: 4,
    });

    // 5. Contrôles en cours
    const controlesEnCours = await (this.prisma as any).taxControleFiscal.count({
      where: {
        taxContribuableId: contribuable.id,
        statut: 'EN_COURS',
      },
    });

    return {
      hasContribuable: true,
      contribuable: {
        id: contribuable.id,
        ifu: contribuable.identifiantFiscalUnique,
        pays: contribuable.pays?.libelle || 'Bénin',
        regime: contribuable.regimeImposition?.libelle || 'Réel Normal',
        secteurActivite: contribuable.secteurActivite || 'Droit commun',
        centreImpots: contribuable.centreImpotsRattachement,
      },
      kpis: {
        tvaNetteMois: declarationTva ? declarationTva.tvaNetteDue : 0,
        creditTvaReporte: declarationTva && declarationTva.tvaNetteDue < 0 ? Math.abs(declarationTva.tvaNetteDue) : 0,
        isEstime: dernierCalculIs ? dernierCalculIs.isDu : 0,
        acomptesIsVerses: dernierCalculIs ? dernierCalculIs.totalAcomptesVerses : 0,
        acomptesIsRestants: dernierCalculIs ? dernierCalculIs.soldeAPayer : 0,
        sourcesEnAttenteQualification: sourcesEnAttente,
        prochainesEcheancesCount: prochainesEcheances.length,
        controlesEnCoursCount: controlesEnCours,
        tauxEffectifEstime: dernierCalculIs && dernierCalculIs.resultatComptableNet > 0
          ? Math.round((dernierCalculIs.isDu / dernierCalculIs.resultatComptableNet) * 1000) / 10
          : (contribuable.secteurActivite?.includes('indus') ? 25.0 : 30.0),
      },
      prochainesEcheances,
      sourcesRecentes,
    };
  }
}
