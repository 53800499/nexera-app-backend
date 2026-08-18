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
  async getSoldesConges(tenantId: string, annee = 2026, employeId?: string) {
    return this.prisma.rhSoldeConge.findMany({
      where: {
        tenantId,
        anneeReference: annee,
        ...(employeId ? { employeId } : {}),
      },
      include: { employe: true },
      orderBy: { employe: { nom: 'asc' } },
    });
  }

  async adjustSoldeConge(employeId: string, dto: AdjustSoldeCongeDto, tenantId: string) {
    const solde = await this.prisma.rhSoldeConge.findUnique({
      where: {
        tenantId_employeId_anneeReference: {
          tenantId,
          employeId,
          anneeReference: dto.anneeReference,
        },
      },
    });

    const soldeDebut = solde?.soldeDebutAnnee ?? 0;
    const acquis = dto.droitsAcquis ?? solde?.droitsAcquis ?? 0;
    const supAnc = dto.droitsSupplementairesAnciennete ?? solde?.droitsSupplementairesAnciennete ?? 0;
    const supEnf = dto.droitsSupplementairesEnfants ?? solde?.droitsSupplementairesEnfants ?? 0;
    const consommes = dto.joursConsommes ?? solde?.joursConsommes ?? 0;
    const reporte = solde?.soldeReporte ?? 0;

    const totalDroits = soldeDebut + acquis + supAnc + supEnf + reporte;
    const restants = Math.max(0, totalDroits - consommes);

    return this.prisma.rhSoldeConge.upsert({
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
        droitsAcquis: acquis,
        droitsSupplementairesAnciennete: supAnc,
        droitsSupplementairesEnfants: supEnf,
        joursConsommes: consommes,
        joursRestants: restants,
      },
    });
  }
}
