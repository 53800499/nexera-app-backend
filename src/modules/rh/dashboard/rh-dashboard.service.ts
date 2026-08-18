import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class RhDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(tenantId: string) {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    // 1. Effectifs
    const [totalEmployes, totalActifs, employesParGenre, employesParDepartement] =
      await Promise.all([
        this.prisma.rhEmploye.count({ where: { tenantId, isDeleted: false } }),
        this.prisma.rhEmploye.count({
          where: { tenantId, isDeleted: false, statutEmploi: 'ACTIF' },
        }),
        this.prisma.rhEmploye.groupBy({
          by: ['sexe'],
          where: { tenantId, isDeleted: false, statutEmploi: 'ACTIF' },
          _count: { id: true },
        }),
        this.prisma.rhEmployeAffectation.groupBy({
          by: ['departementId'],
          where: { tenantId, estActuelle: true },
          _count: { id: true },
        }),
      ]);

    // 2. Contrats
    const [totalContratsActifs, contratsParType, contratsExpirantBientot, essaisEnCours] =
      await Promise.all([
        this.prisma.rhContrat.count({ where: { tenantId, statut: 'ACTIF' } }),
        this.prisma.rhContrat.groupBy({
          by: ['typeContrat'],
          where: { tenantId, statut: 'ACTIF' },
          _count: { id: true },
        }),
        this.prisma.rhContrat.findMany({
          where: {
            tenantId,
            statut: 'ACTIF',
            dateFinPrevue: { gte: now, lte: in30Days },
          },
          include: { employe: true },
          take: 5,
        }),
        this.prisma.rhContratPeriodeEssai.findMany({
          where: {
            contrat: { tenantId, statut: 'ACTIF' },
            statutIssue: 'EN_COURS',
            dateFin: { lte: in30Days },
          },
          include: { contrat: { include: { employe: true } } },
          take: 5,
        }),
      ]);

    // 3. Dernier cycle de paie & Masse salariale
    const dernierCycle = await this.prisma.rhCyclePaie.findFirst({
      where: { tenantId },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
      include: {
        bulletinsPaie: true,
      },
    });

    let masseSalarialeBrute = 0;
    let totalNetAPayer = 0;
    let totalIts = 0;
    let totalCnss = 0;
    let totalVps = 0;
    let totalChargesPatronales = 0;

    if (dernierCycle && dernierCycle.bulletinsPaie.length > 0) {
      for (const b of dernierCycle.bulletinsPaie) {
        masseSalarialeBrute += b.totalSalaireBrut;
        totalNetAPayer += b.netAPayer;
        totalIts += b.montantImpotSalaire;
        totalCnss += b.montantCnssSalariale + b.montantCnssPatronale;
        totalVps += b.montantVpsPatronale;
        totalChargesPatronales += b.totalChargesPatronales;
      }
    }

    // 4. Congés & Absences
    const [absencesEnAttente, employesEnCongeAujourdhui] = await Promise.all([
      this.prisma.rhAbsence.count({
        where: { tenantId, statut: 'SOUMIS' },
      }),
      this.prisma.rhAbsence.count({
        where: {
          tenantId,
          statut: 'VALIDE_RH',
          dateDebut: { lte: now },
          dateFin: { gte: now },
        },
      }),
    ]);

    // Résoudre noms des départements
    const departementIds = employesParDepartement.map((d) => d.departementId);
    const depts = await this.prisma.rhDepartement.findMany({
      where: { id: { in: departementIds } },
    });
    const deptsMap = new Map(depts.map((d) => [d.id, d.libelle]));

    const repartitionDept = employesParDepartement.map((d) => ({
      departementId: d.departementId,
      libelle: deptsMap.get(d.departementId) || 'Non assigné',
      count: d._count.id,
    }));

    return {
      kpi: {
        totalEmployes,
        totalActifs,
        totalContratsActifs,
        masseSalarialeBrute,
        totalNetAPayer,
        totalIts,
        totalCnss,
        totalVps,
        totalChargesPatronales,
        absencesEnAttente,
        employesEnCongeAujourdhui,
      },
      dernierCycle: dernierCycle
        ? {
            id: dernierCycle.id,
            annee: dernierCycle.annee,
            mois: dernierCycle.mois,
            codeCycle: dernierCycle.codeCycle,
            statut: dernierCycle.statut,
            nombreBulletins: dernierCycle.bulletinsPaie.length,
          }
        : null,
      alertes: {
        contratsExpirantBientot: contratsExpirantBientot.map((c) => ({
          contratId: c.id,
          numeroContrat: c.numeroContrat,
          employeNom: `${c.employe.nom} ${c.employe.prenoms}`,
          matricule: c.employe.matricule,
          dateFinPrevue: c.dateFinPrevue,
        })),
        essaisExpirantBientot: essaisEnCours.map((e) => ({
          contratId: e.contratId,
          employeNom: `${e.contrat.employe.nom} ${e.contrat.employe.prenoms}`,
          matricule: e.contrat.employe.matricule,
          dateFinEssai: e.dateFin,
          estRenouvele: e.estRenouvele,
        })),
      },
      repartition: {
        parGenre: employesParGenre.map((g) => ({
          genre: g.sexe || 'M',
          count: g._count.id,
        })),
        parTypeContrat: contratsParType.map((c) => ({
          type: c.typeContrat,
          count: c._count.id,
        })),
        parDepartement: repartitionDept,
      },
    };
  }
}
