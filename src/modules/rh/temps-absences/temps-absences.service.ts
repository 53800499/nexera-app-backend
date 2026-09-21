import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';
import {
  AdjustSoldeCongeDto,
  BatchReleveTempsDto,
  CreateAbsenceDto,
  CreatePlanningHoraireDto,
  CreateReleveTempsDto,
  ValidateAbsenceDto,
  ValidateReleveTempsDto,
} from './dto/temps-absences.dto';

@Injectable()
export class TempsAbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: RhAuditService,
  ) {}

  // ---------------- PLANNINGS HORAIRES ----------------
  async getPlannings(tenantId: string, etablissementId?: string) {
    return this.prisma.rhPlanningHoraire.findMany({
      where: {
        tenantId,
        ...(etablissementId ? { etablissementId } : {}),
      },
      include: {
        etablissement: true,
        _count: { select: { affectationsHoraires: true } },
      },
      orderBy: { libelle: 'asc' },
    });
  }

  async createPlanning(dto: CreatePlanningHoraireDto, tenantId: string) {
    return this.prisma.rhPlanningHoraire.create({
      data: {
        tenantId,
        etablissementId: dto.etablissementId,
        code: dto.code,
        libelle: dto.libelle,
        typeAmenagement: dto.typeAmenagement ?? 'HEBDOMADAIRE_STANDARD',
        heuresHebdomadairesStandard: dto.heuresHebdomadairesStandard ?? 40,
        detailsGrilleJson: dto.detailsGrilleJson ?? null,
      },
    });
  }

  // ---------------- RELEVÉS DE TEMPS / HEURES SUP ----------------
  async getRelevesTemps(
    tenantId: string,
    employeId?: string,
    dateDebut?: string,
    dateFin?: string,
    statut?: string,
  ) {
    const where: any = {
      tenantId,
      ...(employeId ? { employeId } : {}),
      ...(statut ? { statutValidation: statut } : {}),
    };

    if (dateDebut && dateFin) {
      where.dateJour = {
        gte: new Date(dateDebut),
        lte: new Date(dateFin),
      };
    }

    return this.prisma.rhReleveTemps.findMany({
      where,
      include: { employe: true },
      orderBy: { dateJour: 'asc' },
    });
  }

  async createOrUpdateReleveTemps(dto: CreateReleveTempsDto, tenantId: string) {
    const dateJour = new Date(dto.dateJour);

    return this.prisma.rhReleveTemps.upsert({
      where: {
        tenantId_employeId_dateJour: {
          tenantId,
          employeId: dto.employeId,
          dateJour,
        },
      },
      create: {
        tenantId,
        employeId: dto.employeId,
        dateJour,
        heureArriveeReelle: dto.heureArriveeReelle,
        heureDepartReelle: dto.heureDepartReelle,
        pauseMinutes: dto.pauseMinutes ?? 0,
        heuresNormales: dto.heuresNormales ?? 8,
        heuresSup15: dto.heuresSup15 ?? 0,
        heuresSup50: dto.heuresSup50 ?? 0,
        heuresSupNuit: dto.heuresSupNuit ?? 0,
        heuresSupDimancheFerie: dto.heuresSupDimancheFerie ?? 0,
        statutValidation: 'SAISI',
      },
      update: {
        heureArriveeReelle: dto.heureArriveeReelle,
        heureDepartReelle: dto.heureDepartReelle,
        pauseMinutes: dto.pauseMinutes,
        heuresNormales: dto.heuresNormales,
        heuresSup15: dto.heuresSup15,
        heuresSup50: dto.heuresSup50,
        heuresSupNuit: dto.heuresSupNuit,
        heuresSupDimancheFerie: dto.heuresSupDimancheFerie,
      },
    });
  }

  async batchCreateRelevesTemps(dto: BatchReleveTempsDto, tenantId: string) {
    const results: any[] = [];
    for (const rel of dto.releves) {
      const res = await this.createOrUpdateReleveTemps(rel, tenantId);
      results.push(res);
    }
    return { count: results.length, data: results };
  }

  async validateReleveTemps(id: string, dto: ValidateReleveTempsDto, tenantId: string, userId?: string) {
    const releve = await this.prisma.rhReleveTemps.findFirst({ where: { id, tenantId } });
    if (!releve) throw new NotFoundException('Relevé de temps introuvable');

    return this.prisma.rhReleveTemps.update({
      where: { id },
      data: {
        statutValidation: dto.statutValidation,
        validePar: userId,
        valideA: new Date(),
      },
    });
  }

  // ---------------- ABSENCES & CONGÉS ----------------
  async getAbsences(
    tenantId: string,
    employeId?: string,
    statut?: string,
    typeAbsenceId?: string,
    annee?: number,
  ) {
    const where: any = {
      tenantId,
      ...(employeId ? { employeId } : {}),
      ...(statut ? { statut } : {}),
      ...(typeAbsenceId ? { typeAbsenceId } : {}),
    };

    if (annee) {
      where.dateDebut = {
        gte: new Date(`${annee}-01-01T00:00:00Z`),
        lte: new Date(`${annee}-12-31T23:59:59Z`),
      };
    }

    return this.prisma.rhAbsence.findMany({
      where,
      include: {
        employe: true,
        typeAbsence: true,
      },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async createAbsence(dto: CreateAbsenceDto, tenantId: string, userId?: string) {
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: dto.employeId, tenantId },
    });
    if (!employe) throw new NotFoundException('Employé introuvable');

    const typeAbsence = await this.prisma.rhTypeAbsence.findUnique({
      where: { id: dto.typeAbsenceId },
    });
    if (!typeAbsence) throw new NotFoundException('Type d’absence introuvable');

    // Vérifier solde disponible si déduit du solde
    if (typeAbsence.deduitSoldeConge) {
      const currentYear = new Date(dto.dateDebut).getFullYear();
      const solde = await this.prisma.rhSoldeConge.findFirst({
        where: { tenantId, employeId: dto.employeId, anneeReference: currentYear },
      });

      if (solde && solde.joursRestants < dto.nombreJoursOuvrables) {
        throw new BadRequestException(
          `Solde de congés insuffisant : ${solde.joursRestants} jour(s) restant(s), demande de ${dto.nombreJoursOuvrables} jour(s).`,
        );
      }
    }

    const absence = await this.prisma.rhAbsence.create({
      data: {
        tenantId,
        employeId: dto.employeId,
        typeAbsenceId: dto.typeAbsenceId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        demiJourneeDebut: dto.demiJourneeDebut ?? false,
        demiJourneeFin: dto.demiJourneeFin ?? false,
        nombreJoursOuvrables: dto.nombreJoursOuvrables,
        nombreJoursCalendaires: dto.nombreJoursCalendaires ?? dto.nombreJoursOuvrables * 1.25,
        motif: dto.motif,
        documentJustificatifUrl: dto.documentJustificatifUrl,
        statut: 'SOUMIS',
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_absence',
      entiteId: absence.id,
      actionAudit: 'CREATION',
      champsModifiesJson: { dateDebut: dto.dateDebut, dateFin: dto.dateFin, jours: dto.nombreJoursOuvrables },
    });

    return absence;
  }

  async validateAbsence(id: string, dto: ValidateAbsenceDto, tenantId: string, userId?: string) {
    const absence = await this.prisma.rhAbsence.findFirst({
      where: { id, tenantId },
      include: { typeAbsence: true },
    });
    if (!absence) throw new NotFoundException('Demande d’absence introuvable');

    const updated = await this.prisma.rhAbsence.update({
      where: { id },
      data: {
        statut: dto.statut,
        validePar: userId,
        dateValidation: new Date(),
        commentaireRejet: dto.commentaireRejet,
      },
    });

    // Si validation finale RH et déduit solde, impacter le compteur de congés
    if (dto.statut === 'VALIDE_RH' && absence.typeAbsence.deduitSoldeConge) {
      const year = absence.dateDebut.getFullYear();
      const solde = await this.prisma.rhSoldeConge.findFirst({
        where: { tenantId, employeId: absence.employeId, anneeReference: year },
      });

      if (solde) {
        const nouveauxJoursConsommes = solde.joursConsommes + absence.nombreJoursOuvrables;
        const totalDroits =
          solde.soldeDebutAnnee +
          solde.droitsAcquis +
          solde.droitsSupplementairesAnciennete +
          solde.droitsSupplementairesEnfants +
          solde.soldeReporte;
        const nouveauxJoursRestants = Math.max(0, totalDroits - nouveauxJoursConsommes);

        await this.prisma.rhSoldeConge.update({
          where: { id: solde.id },
          data: {
            joursConsommes: nouveauxJoursConsommes,
            joursRestants: nouveauxJoursRestants,
          },
        });
      }
    }

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_absence',
      entiteId: id,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: { statut: dto.statut },
    });

    return updated;
  }

  async getTypesAbsence() {
    return this.prisma.rhTypeAbsence.findMany({
      orderBy: { code: 'asc' },
    });
  }

  // ---------------- SOLDES DE CONGÉS ----------------

  /**
   * Calcule et met à jour le compteur de congés d'un employé selon la législation béninoise (Code du Travail & CCGT).
   * - 2 jours ouvrables par mois de service effectif (24 j / an complet)
   * - Majorations d'ancienneté : +2 j (>=20 ans), +4 j (>=25 ans), +6 j (>=30 ans)
   * - Majorations enfants à charge : +2 j par enfant mineur (<14 ans)
   * - Prise en compte des absences validées déduites du solde
   * - Report automatique du solde restant N-1
   */
  async calculerSoldeCongeEmploye(tenantId: string, employeId: string, annee: number) {
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: employeId, tenantId },
    });
    if (!employe) return null;

    // 1. Calcul de la durée de service effectif sur l'année de référence
    const entryDate = employe.dateEntreeEntreprise ? new Date(employe.dateEntreeEntreprise) : new Date(annee, 0, 1);
    const entryYear = entryDate.getFullYear();

    let moisTravailles = 12;
    if (entryYear > annee) {
      moisTravailles = 0;
    } else if (entryYear === annee) {
      const entryMonth = entryDate.getMonth(); // 0-11
      const entryDay = entryDate.getDate();
      const daysInMonth = new Date(annee, entryMonth + 1, 0).getDate();
      const remainingDays = daysInMonth - entryDay + 1;
      // Art. 68 : toute période de 15 jours de service effectif équivaut à un mois complet
      const fraction = remainingDays >= 15 ? 1 : Math.round((remainingDays / daysInMonth) * 10) / 10;
      const fullMonths = 11 - entryMonth;
      moisTravailles = Math.min(12, fullMonths + fraction);
    }

    // Gestion de sortie éventuelle dans l'année
    if (employe.dateSortieDefinitive) {
      const exitDate = new Date(employe.dateSortieDefinitive);
      if (exitDate.getFullYear() === annee) {
        const exitMonth = exitDate.getMonth();
        const exitDay = exitDate.getDate();
        const fraction = exitDay >= 15 ? 1 : 0.5;
        moisTravailles = Math.min(moisTravailles, exitMonth + fraction);
      } else if (exitDate.getFullYear() < annee) {
        moisTravailles = 0;
      }
    }

    // Droits acquis de base (2 jours ouvrables par mois)
    const droitsAcquisBase = Math.round(moisTravailles * 2 * 2) / 2;

    // 2. Ancienneté
    const refAnciennete = employe.dateAnciennete ? new Date(employe.dateAnciennete) : entryDate;
    const anneesAnciennete = Math.max(0, annee - refAnciennete.getFullYear());
    let droitsSupAnciennete = 0;
    if (anneesAnciennete >= 30) {
      droitsSupAnciennete = 6;
    } else if (anneesAnciennete >= 25) {
      droitsSupAnciennete = 4;
    } else if (anneesAnciennete >= 20) {
      droitsSupAnciennete = 2;
    }

    // 3. Enfants à charge mineurs (< 14 ans)
    let droitsSupEnfants = 0;
    if ((employe.nombreEnfantsCharge ?? 0) > 0) {
      droitsSupEnfants = (employe.nombreEnfantsCharge ?? 0) * 2;
    }

    // 4. Jours consommés (absences validées RH ou manager avec deduitSoldeConge)
    const startOfYear = new Date(annee, 0, 1);
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59, 999);

    const absencesConsommees = await this.prisma.rhAbsence.findMany({
      where: {
        tenantId,
        employeId: employe.id,
        statut: { in: ['VALIDE_RH', 'VALIDE_MANAGER'] },
        typeAbsence: { deduitSoldeConge: true },
        dateDebut: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });
    const joursConsommes = absencesConsommees.reduce((acc, a) => acc + (a.nombreJoursOuvrables || 0), 0);

    // 5. Récupérer l'existant pour préserver d'éventuels ajustements manuels ou reports
    const existing = await this.prisma.rhSoldeConge.findUnique({
      where: {
        tenantId_employeId_anneeReference: {
          tenantId,
          employeId: employe.id,
          anneeReference: annee,
        },
      },
    });

    let soldeDebut = existing?.soldeDebutAnnee ?? 0;
    let soldeReporte = existing?.soldeReporte ?? 0;

    // Report automatique de N-1 si non initialisé
    if (!existing || (existing.soldeReporte === 0 && existing.soldeDebutAnnee === 0)) {
      const prevYear = await this.prisma.rhSoldeConge.findUnique({
        where: {
          tenantId_employeId_anneeReference: {
            tenantId,
            employeId: employe.id,
            anneeReference: annee - 1,
          },
        },
      });
      if (prevYear && prevYear.joursRestants > 0) {
        soldeReporte = prevYear.joursRestants;
      }
    }

    // Droits acquis à appliquer (prend la valeur calculée si l'enregistrement avait 0)
    const droitsAcquis = existing && existing.droitsAcquis > 0 ? existing.droitsAcquis : droitsAcquisBase;
    const supAnc = existing && existing.droitsSupplementairesAnciennete > 0 ? existing.droitsSupplementairesAnciennete : droitsSupAnciennete;
    const supEnf = existing && existing.droitsSupplementairesEnfants > 0 ? existing.droitsSupplementairesEnfants : droitsSupEnfants;

    const totalDroits = soldeDebut + droitsAcquis + supAnc + supEnf + soldeReporte;
    const joursRestants = Math.max(0, totalDroits - joursConsommes);

    const saved = await this.prisma.rhSoldeConge.upsert({
      where: {
        tenantId_employeId_anneeReference: {
          tenantId,
          employeId: employe.id,
          anneeReference: annee,
        },
      },
      create: {
        tenantId,
        employeId: employe.id,
        anneeReference: annee,
        soldeDebutAnnee: soldeDebut,
        droitsAcquis,
        droitsSupplementairesAnciennete: supAnc,
        droitsSupplementairesEnfants: supEnf,
        joursConsommes,
        joursRestants,
        soldeReporte,
      },
      update: {
        droitsAcquis,
        droitsSupplementairesAnciennete: supAnc,
        droitsSupplementairesEnfants: supEnf,
        joursConsommes,
        joursRestants,
        soldeReporte,
      },
      include: { employe: true },
    });

    return {
      ...saved,
      droitsAcquisJours: saved.droitsAcquis,
      joursPris: saved.joursConsommes,
    };
  }

  async getSoldesConges(tenantId: string, annee = 2026, employeId?: string) {
    // 1. Trouver les employés concernés
    const employes = await this.prisma.rhEmploye.findMany({
      where: {
        tenantId,
        statutEmploi: { not: 'SORTI' },
        ...(employeId ? { id: employeId } : {}),
      },
      select: { id: true },
    });

    // 2. Pour chaque employé actif, calculer/initialiser s'il n'existe pas ou s'il est à 0
    for (const emp of employes) {
      const existing = await this.prisma.rhSoldeConge.findUnique({
        where: {
          tenantId_employeId_anneeReference: {
            tenantId,
            employeId: emp.id,
            anneeReference: annee,
          },
        },
      });

      if (!existing || (existing.droitsAcquis === 0 && existing.joursRestants === 0 && existing.joursConsommes === 0)) {
        await this.calculerSoldeCongeEmploye(tenantId, emp.id, annee);
      }
    }

    // 3. Renvoyer les soldes avec alias complets pour compatibilité frontend
    const soldes = await this.prisma.rhSoldeConge.findMany({
      where: {
        tenantId,
        anneeReference: annee,
        ...(employeId ? { employeId } : {}),
      },
      include: { employe: true },
      orderBy: { employe: { nom: 'asc' } },
    });

    return soldes.map((s) => ({
      ...s,
      droitsAcquisJours: s.droitsAcquis,
      joursPris: s.joursConsommes,
    }));
  }

  async recalculerSoldesConges(tenantId: string, annee = 2026, employeId?: string) {
    const employes = await this.prisma.rhEmploye.findMany({
      where: {
        tenantId,
        statutEmploi: { not: 'SORTI' },
        ...(employeId ? { id: employeId } : {}),
      },
      select: { id: true },
    });

    const results: any[] = [];
    for (const emp of employes) {
      // Force recalculation of rights based on current dates and absences
      const res = await this.calculerSoldeCongeEmploye(tenantId, emp.id, annee);
      if (res) results.push(res);
    }

    return results;
  }

  async adjustSoldeConge(employeId: string, dto: AdjustSoldeCongeDto, tenantId: string, userId?: string) {
    const solde = await this.prisma.rhSoldeConge.findUnique({
      where: {
        tenantId_employeId_anneeReference: {
          tenantId,
          employeId,
          anneeReference: dto.anneeReference,
        },
      },
    });

    const soldeDebut = dto.soldeDebutAnnee ?? solde?.soldeDebutAnnee ?? 0;
    const acquis = dto.droitsAcquis ?? solde?.droitsAcquis ?? 0;
    const supAnc = dto.droitsSupplementairesAnciennete ?? solde?.droitsSupplementairesAnciennete ?? 0;
    const supEnf = dto.droitsSupplementairesEnfants ?? solde?.droitsSupplementairesEnfants ?? 0;
    const consommes = dto.joursConsommes ?? solde?.joursConsommes ?? 0;
    const reporte = dto.soldeReporte ?? solde?.soldeReporte ?? 0;

    const totalDroits = soldeDebut + acquis + supAnc + supEnf + reporte;
    const restants = Math.max(0, totalDroits - consommes);

    const updated = await this.prisma.rhSoldeConge.upsert({
      where: {
        tenantId_employeId_anneeReference: {
          tenantId,
          employeId,
          anneeReference: dto.anneeReference,
        },
      },
      create: {
        tenantId,
        employeId,
        anneeReference: dto.anneeReference,
        soldeDebutAnnee: soldeDebut,
        droitsAcquis: acquis,
        droitsSupplementairesAnciennete: supAnc,
        droitsSupplementairesEnfants: supEnf,
        joursConsommes: consommes,
        joursRestants: restants,
        soldeReporte: reporte,
      },
      update: {
        soldeDebutAnnee: soldeDebut,
        droitsAcquis: acquis,
        droitsSupplementairesAnciennete: supAnc,
        droitsSupplementairesEnfants: supEnf,
        joursConsommes: consommes,
        joursRestants: restants,
        soldeReporte: reporte,
      },
      include: { employe: true },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_solde_conge',
      entiteId: updated.id,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: {
        annee: dto.anneeReference,
        droitsAcquis: acquis,
        joursConsommes: consommes,
        joursRestants: restants,
        motif: dto.motif ?? 'Ajustement manuel RH',
      },
    });

    return {
      ...updated,
      droitsAcquisJours: updated.droitsAcquis,
      joursPris: updated.joursConsommes,
    };
  }
}
