import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';
import {
  CreateAvenantDto,
  CreateContratDto,
  CreateRuptureDto,
  IssueEssaiDto,
  RenouvelerEssaiDto,
  UpdateContratDto,
} from './dto/contrat.dto';

@Injectable()
export class ContratsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: RhAuditService,
  ) {}

  private async generateNumeroContrat(tenantId: string): Promise<string> {
    const count = await this.prisma.rhContrat.count({ where: { tenantId } });
    const nextNum = (count + 1).toString().padStart(6, '0');
    return `CTR-${nextNum}`;
  }

  async findAll(
    tenantId: string,
    employeId?: string,
    statut?: string,
    typeContrat?: string,
    etablissementId?: string,
  ) {
    const where: any = {
      tenantId,
      ...(employeId ? { employeId } : {}),
      ...(statut ? { statut } : {}),
      ...(typeContrat ? { typeContrat } : {}),
      ...(etablissementId ? { etablissementId } : {}),
    };

    return this.prisma.rhContrat.findMany({
      where,
      include: {
        employe: true,
        etablissement: true,
        poste: true,
        categorieProfessionnelle: true,
        periodeEssai: true,
        _count: {
          select: { avenants: true, bulletinsPaie: true },
        },
      },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const contrat = await this.prisma.rhContrat.findFirst({
      where: { id, tenantId },
      include: {
        employe: {
          include: {
            soldesConges: { take: 1, orderBy: { anneeReference: 'desc' } },
          },
        },
        etablissement: true,
        poste: true,
        categorieProfessionnelle: true,
        conventionCollective: true,
        periodeEssai: true,
        avenants: { orderBy: { dateEffet: 'desc' } },
        rupture: {
          include: { soldesToutCompte: true },
        },
      },
    });

    if (!contrat) {
      throw new NotFoundException(`Contrat ${id} introuvable`);
    }

    return contrat;
  }

  async create(dto: CreateContratDto, tenantId: string, userId?: string) {
    const numeroContrat =
      dto.numeroContrat?.trim() || (await this.generateNumeroContrat(tenantId));

    const existing = await this.prisma.rhContrat.findFirst({
      where: { tenantId, numeroContrat },
    });
    if (existing) {
      throw new ConflictException(`Le numéro de contrat ${numeroContrat} existe déjà.`);
    }

    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: dto.employeId, tenantId },
    });
    if (!employe) {
      throw new NotFoundException('Employé introuvable');
    }

    const startDate = new Date(dto.dateDebut);

    const contrat = await this.prisma.rhContrat.create({
      data: {
        tenantId,
        employeId: dto.employeId,
        etablissementId: dto.etablissementId,
        numeroContrat,
        typeContrat: dto.typeContrat,
        statut: 'ACTIF',
        dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : null,
        dateDebut: startDate,
        dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : null,
        clauseExclusivite: dto.clauseExclusivite ?? false,
        clauseNonConcurrence: dto.clauseNonConcurrence ?? false,
        salaireBaseMensuel: dto.salaireBaseMensuel,
        deviseCode: dto.deviseCode ?? 'XOF',
        dureeHebdoContrat: dto.dureeHebdoContrat ?? 40,
        posteId: dto.posteId,
        categorieProfessionnelleId: dto.categorieProfessionnelleId,
        conventionCollectiveId: dto.conventionCollectiveId,
        fichierContratUrl: dto.fichierContratUrl,
        notes: dto.notes,
      },
    });

    // Période d'essai
    if (dto.periodeEssaiMois && dto.periodeEssaiMois > 0) {
      const trialEndDate = new Date(startDate);
      trialEndDate.setMonth(trialEndDate.getMonth() + dto.periodeEssaiMois);

      await this.prisma.rhContratPeriodeEssai.create({
        data: {
          contratId: contrat.id,
          dureeJoursOuvres: dto.periodeEssaiMois * 22,
          dateDebut: startDate,
          dateFin: trialEndDate,
          statutIssue: 'EN_COURS',
        },
      });
    }

    // Historique de salaire initial
    await this.prisma.rhHistoriqueSalaire.create({
      data: {
        tenantId,
        employeId: dto.employeId,
        dateEffet: startDate,
        ancienSalaireBase: 0,
        nouveauSalaireBase: dto.salaireBaseMensuel,
        motifChangement: 'Salaire initial à l’embauche',
        creePar: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_contrat',
      entiteId: contrat.id,
      actionAudit: 'CREATION',
      champsModifiesJson: { numeroContrat, typeContrat: contrat.typeContrat },
    });

    return contrat;
  }

  async update(id: string, dto: UpdateContratDto, tenantId: string, userId?: string) {
    const contrat = await this.findOne(id, tenantId);

    const updated = await this.prisma.rhContrat.update({
      where: { id },
      data: {
        ...dto,
        dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : undefined,
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_contrat',
      entiteId: id,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: dto,
    });

    return updated;
  }

  // --- PÉRIODE D'ESSAI ---
  async renouvelerEssai(contratId: string, dto: RenouvelerEssaiDto, tenantId: string) {
    const contrat = await this.findOne(contratId, tenantId);
    if (!contrat.periodeEssai) {
      throw new BadRequestException('Ce contrat ne comporte pas de période d’essai.');
    }

    if (contrat.periodeEssai.estRenouvele) {
      throw new BadRequestException('La période d’essai a déjà été renouvelée une fois (limite légale Art. 21 CT Bénin).');
    }

    return this.prisma.rhContratPeriodeEssai.update({
      where: { contratId },
      data: {
        estRenouvele: true,
        dateDebutRenouvellement: new Date(dto.dateDebutRenouvellement),
        dateFinRenouvellement: new Date(dto.dateFinRenouvellement),
        statutIssue: 'RENOUVELEE',
        motifRupture: dto.motif,
      },
    });
  }

  async cloreEssai(contratId: string, dto: IssueEssaiDto, tenantId: string) {
    await this.findOne(contratId, tenantId);

    const essai = await this.prisma.rhContratPeriodeEssai.update({
      where: { contratId },
      data: {
        statutIssue: dto.statutIssue,
        dateNotificationRupture: dto.dateNotificationRupture ? new Date(dto.dateNotificationRupture) : null,
        motifRupture: dto.motifRupture,
      },
    });

    if (dto.statutIssue === 'ROMPUE_EMPLOYEUR' || dto.statutIssue === 'ROMPUE_SALARIE') {
      await this.prisma.rhContrat.update({
        where: { id: contratId },
        data: { statut: 'ROMPU' },
      });
    }

    return essai;
  }

  // --- AVENANTS ---
  async createAvenant(contratId: string, dto: CreateAvenantDto, tenantId: string, userId?: string) {
    const contrat = await this.findOne(contratId, tenantId);

    const count = await this.prisma.rhContratAvenant.count({ where: { contratId } });
    const numeroAvenant = dto.numeroAvenant || `AVN-${(count + 1).toString().padStart(3, '0')}`;

    const dateEffet = new Date(dto.dateEffet);

    const avenant = await this.prisma.rhContratAvenant.create({
      data: {
        contratId,
        numeroAvenant,
        dateNotification: dto.dateNotification ? new Date(dto.dateNotification) : null,
        dateEffet,
        typeModification: dto.typeModification,
        detailsModificationsJson: dto.detailsModificationsJson ?? null,
        salaireBaseAvant: contrat.salaireBaseMensuel,
        salaireBaseApres: dto.salaireBaseApres,
        tempsTravailAvant: contrat.dureeHebdoContrat,
        tempsTravailApres: dto.tempsTravailApres,
        fichierAvenantUrl: dto.fichierAvenantUrl,
      },
    });

    // Mettre à jour le contrat et historiser le salaire si modification salariale
    if (dto.salaireBaseApres && dto.salaireBaseApres !== contrat.salaireBaseMensuel) {
      await this.prisma.rhContrat.update({
        where: { id: contratId },
        data: { salaireBaseMensuel: dto.salaireBaseApres },
      });

      await this.prisma.rhHistoriqueSalaire.create({
        data: {
          tenantId,
          employeId: contrat.employeId,
          dateEffet,
          ancienSalaireBase: contrat.salaireBaseMensuel,
          nouveauSalaireBase: dto.salaireBaseApres,
          motifChangement: `Avenant ${numeroAvenant} - ${dto.typeModification}`,
          referenceAvenantId: avenant.id,
          creePar: userId,
        },
      });
    }

    return avenant;
  }

  // --- RUPTURE DE CONTRAT & CALCUL INDEMNITÉS ---
  async createRupture(contratId: string, dto: CreateRuptureDto, tenantId: string, userId?: string) {
    const contrat = await this.findOne(contratId, tenantId);

    const rupture = await this.prisma.rhContratRupture.create({
      data: {
        contratId,
        typeRupture: dto.typeRupture,
        dateNotification: new Date(dto.dateNotification),
        dateEffet: new Date(dto.dateEffet),
        dureePreavisJours: dto.dureePreavisJours ?? 0,
        dispensePreavis: dto.dispensePreavis ?? false,
        montantIndemnitePreavis: dto.montantIndemnitePreavis ?? 0,
        montantIndemniteLicenciement: dto.montantIndemniteLicenciement ?? 0,
        montantIndemniteCongesPayes: dto.montantIndemniteCongesPayes ?? 0,
        montantDommagesInterets: dto.montantDommagesInterets ?? 0,
        motifDetaille: dto.motifDetaille,
      },
    });

    // Passer le contrat en statut ROMPU ou TERMINE
    await this.prisma.rhContrat.update({
      where: { id: contratId },
      data: { statut: 'ROMPU' },
    });

    // Mettre à jour la date de sortie de l'employé
    await this.prisma.rhEmploye.update({
      where: { id: contrat.employeId },
      data: {
        statutEmploi: 'SORTI',
        dateSortieDefinitive: new Date(dto.dateEffet),
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_contrat_rupture',
      entiteId: rupture.id,
      actionAudit: 'CREATION',
      champsModifiesJson: { typeRupture: dto.typeRupture, dateEffet: dto.dateEffet },
    });

    return rupture;
  }

  // Assistant de calcul indicatif des indemnités de licenciement (Convention Collective Générale du Travail Bénin)
  calculateEstimatedSeverance(ancienneteAnnees: number, salaireMoyen12m: number) {
    // CCGT Bénin barème classique :
    // - 1 à 5 ans : 30 % du salaire mensuel moyen par an
    // - 6 à 10 ans : 35 % du salaire mensuel moyen par an
    // - au-delà de 10 ans : 40 % du salaire mensuel moyen par an
    let totalIndemnite = 0;

    if (ancienneteAnnees <= 0) {
      return {
        ancienneteAnnees: 0,
        salaireMoyen12m,
        indemniteLicenciementEstimee: 0,
        tranches: [],
      };
    }

    const tranches: Array<{
      tranche: string;
      annees: number;
      taux: string;
      montant: number;
    }> = [];

    // Tranche 1-5 ans
    const anneesTranche1 = Math.min(ancienneteAnnees, 5);
    const montantT1 = anneesTranche1 * salaireMoyen12m * 0.30;
    totalIndemnite += montantT1;
    tranches.push({ tranche: '1 à 5 ans', annees: anneesTranche1, taux: '30 %', montant: Math.round(montantT1) });

    // Tranche 6-10 ans
    if (ancienneteAnnees > 5) {
      const anneesTranche2 = Math.min(ancienneteAnnees - 5, 5);
      const montantT2 = anneesTranche2 * salaireMoyen12m * 0.35;
      totalIndemnite += montantT2;
      tranches.push({ tranche: '6 à 10 ans', annees: anneesTranche2, taux: '35 %', montant: Math.round(montantT2) });
    }

    // Tranche > 10 ans
    if (ancienneteAnnees > 10) {
      const anneesTranche3 = ancienneteAnnees - 10;
      const montantT3 = anneesTranche3 * salaireMoyen12m * 0.40;
      totalIndemnite += montantT3;
      tranches.push({ tranche: 'Plus de 10 ans', annees: anneesTranche3, taux: '40 %', montant: Math.round(montantT3) });
    }

    return {
      ancienneteAnnees,
      salaireMoyen12m,
      indemniteLicenciementEstimee: Math.round(totalIndemnite),
      tranches,
    };
  }
}
