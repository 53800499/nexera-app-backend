import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';
import { CalculPaieService } from './calcul-paie.service';
import {
  BatchElementVariableDto,
  CalculateCyclePaieDto,
  CreateElementVariableDto,
  CreateRemunerationExceptionnelleDto,
  CreateRubriquePaieDto,
  CreateSoldeToutCompteDto,
  OpenCyclePaieDto,
  SignerSoldeToutCompteDto,
} from './dto/paie.dto';

@Injectable()
export class PaieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: RhAuditService,
    private readonly calculPaieService: CalculPaieService,
  ) {}

  // ---------------- RUBRIQUES DE PAIE ----------------
  async getRubriques(paysCode = 'BJ') {
    return this.prisma.rhRubriquePaie.findMany({
      where: { paysCode, actif: true },
      orderBy: { ordreAffichage: 'asc' },
    });
  }

  async createRubrique(dto: CreateRubriquePaieDto) {
    const existing = await this.prisma.rhRubriquePaie.findFirst({
      where: { paysCode: dto.paysCode, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`La rubrique ${dto.code} existe déjà.`);
    }

    return this.prisma.rhRubriquePaie.create({
      data: {
        paysCode: dto.paysCode,
        code: dto.code,
        libelle: dto.libelle,
        typeRubrique: dto.typeRubrique,
        sensDefaut: dto.sensDefaut ?? 'GAIN',
        assujettiIts: dto.assujettiIts ?? true,
        assujettiCnss: dto.assujettiCnss ?? true,
        assujettiVps: dto.assujettiVps ?? true,
        formuleCalcul: dto.formuleCalcul,
        ordreAffichage: dto.ordreAffichage ?? 100,
        compteComptableCharge: dto.compteComptableCharge,
        compteComptableTiers: dto.compteComptableTiers,
      },
    });
  }

  // ---------------- CYCLES DE PAIE ----------------
  async getCycles(tenantId: string, etablissementId?: string, annee?: number) {
    return this.prisma.rhCyclePaie.findMany({
      where: {
        tenantId,
        ...(etablissementId ? { etablissementId } : {}),
        ...(annee ? { annee } : {}),
      },
      include: {
        etablissement: true,
        _count: {
          select: {
            bulletinsPaie: true,
            elementsVariables: true,
          },
        },
      },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
    });
  }

  async getCycleById(id: string, tenantId: string) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id, tenantId },
      include: {
        etablissement: { include: { pays: true } },
        elementsVariables: {
          include: { employe: true, rubriquePaie: true },
        },
        bulletinsPaie: {
          include: {
            employe: true,
            contrat: { include: { poste: true } },
          },
          orderBy: { employe: { nom: 'asc' } },
        },
        declarations: true,
        ecrituresComptables: {
          include: { lignes: true },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle de paie ${id} introuvable`);
    }

    return cycle;
  }

  async openCycle(dto: OpenCyclePaieDto, tenantId: string) {
    const codeCycle =
      dto.codeCycle ||
      `CYC-${dto.annee}-${dto.mois.toString().padStart(2, '0')}`;

    const existing = await this.prisma.rhCyclePaie.findFirst({
      where: {
        tenantId,
        etablissementId: dto.etablissementId,
        annee: dto.annee,
        mois: dto.mois,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Le cycle de paie ${dto.annee}/${dto.mois} existe déjà pour cet établissement.`,
      );
    }

    // Déterminer dates de début et fin du mois
    const dateDebut = new Date(Date.UTC(dto.annee, dto.mois - 1, 1));
    const dateFin = new Date(Date.UTC(dto.annee, dto.mois, 0, 23, 59, 59));
    const datePaiement = dto.datePaiementPrevue
      ? new Date(dto.datePaiementPrevue)
      : dateFin;

    return this.prisma.rhCyclePaie.create({
      data: {
        tenantId,
        etablissementId: dto.etablissementId,
        annee: dto.annee,
        mois: dto.mois,
        codeCycle,
        dateDebut,
        dateFin,
        datePaiementPrevue: datePaiement,
        statut: 'OUVERT',
      },
    });
  }

  // ---------------- ÉLÉMENTS VARIABLES ----------------
  async getElementsVariables(tenantId: string, cyclePaieId: string) {
    return this.prisma.rhElementVariable.findMany({
      where: { tenantId, cyclePaieId },
      include: { employe: true, rubriquePaie: true },
      orderBy: { employe: { nom: 'asc' } },
    });
  }

  async createOrUpdateElementVariable(
    cyclePaieId: string,
    dto: CreateElementVariableDto,
    tenantId: string,
    userId?: string,
  ) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id: cyclePaieId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Cycle de paie introuvable');
    if (cycle.statut === 'CLOTURE' || cycle.statut === 'COMPTABILISE') {
      throw new BadRequestException('Ce cycle de paie est clôturé et ne peut plus être modifié.');
    }

    return this.prisma.rhElementVariable.create({
      data: {
        tenantId,
        cyclePaieId,
        employeId: dto.employeId,
        rubriquePaieId: dto.rubriquePaieId,
        base: dto.base,
        taux: dto.taux,
        montant: dto.montant,
        commentaire: dto.commentaire,
        validePar: userId,
      },
    });
  }

  async batchCreateElementsVariables(
    cyclePaieId: string,
    dto: BatchElementVariableDto,
    tenantId: string,
    userId?: string,
  ) {
    const results: any[] = [];
    for (const elem of dto.elements) {
      const res = await this.createOrUpdateElementVariable(cyclePaieId, elem, tenantId, userId);
      results.push(res);
    }
    return { count: results.length, data: results };
  }

  // ---------------- CALCUL DE PAIE EN MASSE OU INDIVIDUEL ----------------
  async calculateCycle(
    cyclePaieId: string,
    dto: CalculateCyclePaieDto,
    tenantId: string,
    userId?: string,
  ) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id: cyclePaieId, tenantId },
      include: { etablissement: true },
    });
    if (!cycle) throw new NotFoundException('Cycle de paie introuvable');
    if (cycle.statut === 'CLOTURE' || cycle.statut === 'COMPTABILISE') {
      throw new BadRequestException('Ce cycle de paie est clôturé.');
    }

    // Récupérer les contrats actifs pour cet établissement
    const contractsWhere: any = {
      tenantId,
      etablissementId: cycle.etablissementId,
      statut: 'ACTIF',
    };
    if (dto.employeId) {
      contractsWhere.employeId = dto.employeId;
    }

    const contracts = await this.prisma.rhContrat.findMany({
      where: contractsWhere,
      include: {
        employe: true,
      },
    });

    if (contracts.length === 0) {
      throw new BadRequestException('Aucun contrat actif trouvé pour ce cycle.');
    }

    // Récupérer les variables et heures sup du cycle
    const variables = await this.prisma.rhElementVariable.findMany({
      where: { tenantId, cyclePaieId },
      include: { rubriquePaie: true },
    });

    const timesheets = await this.prisma.rhReleveTemps.findMany({
      where: {
        tenantId,
        dateJour: { gte: cycle.dateDebut, lte: cycle.dateFin },
        statutValidation: { in: ['SAISI', 'VALIDE_MANAGER', 'VALIDE_RH'] },
      },
    });

    const remunerationsExcep = await this.prisma.rhRemunerationExceptionnelle.findMany({
      where: { tenantId, cyclePaieId },
    });

    const calculatedPayslips: any[] = [];

    for (const contract of contracts) {
      const empId = contract.employeId;

      // Variables de l'employé
      const empVars = variables.filter((v) => v.employeId === empId);
      const primesImposables = empVars
        .filter((v) => v.rubriquePaie.typeRubrique === 'GAIN_BRUT' && v.rubriquePaie.code !== 'R100')
        .reduce((sum, v) => sum + v.montant, 0);

      const indemnitesNonImposables = empVars
        .filter((v) => v.rubriquePaie.typeRubrique === 'INDEMNITE_NON_IMPOSABLE')
        .reduce((sum, v) => sum + v.montant, 0);

      const avantagesNature = empVars
        .filter((v) => v.rubriquePaie.typeRubrique === 'AVANTAGE_EN_NATURE')
        .reduce((sum, v) => sum + v.montant, 0);

      const retenuesDiverses = empVars
        .filter((v) => v.rubriquePaie.typeRubrique === 'RETENUE_NETTE_AUTRE')
        .reduce((sum, v) => sum + v.montant, 0);

      // Heures supplémentaires depuis les relevés de temps
      const empTimes = timesheets.filter((t) => t.employeId === empId);
      const hs15 = empTimes.reduce((sum, t) => sum + t.heuresSup15, 0);
      const hs50 = empTimes.reduce((sum, t) => sum + t.heuresSup50, 0);
      const hsNuit = empTimes.reduce((sum, t) => sum + t.heuresSupNuit, 0);
      const hsDimanche = empTimes.reduce((sum, t) => sum + t.heuresSupDimancheFerie, 0);

      // Rémunération exceptionnelle éventuelle
      const empExcep = remunerationsExcep.find((r) => r.employeId === empId);

      const calcResult = this.calculPaieService.calculatePayslip({
        salaireBase: contract.salaireBaseMensuel,
        heuresNormales: 173.33,
        heuresSup15: hs15,
        heuresSup50: hs50,
        heuresSupNuit: hsNuit,
        heuresSupDimancheFerie: hsDimanche,
        primesBrutesImposables: primesImposables,
        indemnitesNonImposables: indemnitesNonImposables,
        avantagesEnNature: avantagesNature,
        retenuesDiverses: retenuesDiverses,
        remunerationExceptionnelle: empExcep
          ? {
              montantBrut: empExcep.montantBrut,
              tauxAbattement: empExcep.tauxAbattementApplique,
              salaireMoyenReference12m: empExcep.salaireMoyenReference12m,
            }
          : undefined,
      });

      const numeroBulletin = `BUL-${cycle.annee}-${cycle.mois.toString().padStart(2, '0')}-${contract.employe.matricule}`;

      // Upsert du bulletin de paie
      const payslip = await this.prisma.rhBulletinPaie.upsert({
        where: {
          tenantId_cyclePaieId_employeId: {
            tenantId,
            cyclePaieId,
            employeId: empId,
          },
        },
        create: {
          tenantId,
          cyclePaieId,
          employeId: empId,
          contratId: contract.id,
          numeroBulletin,
          dateDebutPeriode: cycle.dateDebut,
          dateFinPeriode: cycle.dateFin,
          datePaiement: cycle.datePaiementPrevue,
          salaireBase: calcResult.salaireBase,
          heuresNormales: calcResult.heuresNormales,
          heuresSupplementairesTotal: hs15 + hs50 + hsNuit + hsDimanche,
          montantHeuresSup: calcResult.montantHeuresSup,
          montantPrimesIndemnitesBrutes: calcResult.montantPrimesBrutes,
          montantAvantagesNature: calcResult.montantAvantagesNature,
          totalSalaireBrut: calcResult.totalSalaireBrut,
          totalAssietteCnss: calcResult.totalAssietteCnss,
          totalAssietteIts: calcResult.totalAssietteIts,
          totalAssietteVps: calcResult.totalAssietteVps,
          montantCnssSalariale: calcResult.montantCnssSalariale,
          montantImpotSalaire: calcResult.montantImpotSalaireTotal,
          montantAutresRetenuesSalariales: retenuesDiverses,
          totalRetenuesSalariales: calcResult.totalRetenuesSalariales,
          montantCnssPatronale: calcResult.montantCnssPatronale,
          montantVpsPatronale: calcResult.montantVpsPatronale,
          montantChargesPatronalesDiverses: 0,
          totalChargesPatronales: calcResult.totalChargesPatronales,
          netImposable: calcResult.netImposable,
          netAPayer: calcResult.netAPayer,
          netApresRetenues: calcResult.netAPayer,
          statut: 'CALCULE',
        },
        update: {
          salaireBase: calcResult.salaireBase,
          heuresSupplementairesTotal: hs15 + hs50 + hsNuit + hsDimanche,
          montantHeuresSup: calcResult.montantHeuresSup,
          montantPrimesIndemnitesBrutes: calcResult.montantPrimesBrutes,
          montantAvantagesNature: calcResult.montantAvantagesNature,
          totalSalaireBrut: calcResult.totalSalaireBrut,
          totalAssietteCnss: calcResult.totalAssietteCnss,
          totalAssietteIts: calcResult.totalAssietteIts,
          totalAssietteVps: calcResult.totalAssietteVps,
          montantCnssSalariale: calcResult.montantCnssSalariale,
          montantImpotSalaire: calcResult.montantImpotSalaireTotal,
          montantAutresRetenuesSalariales: retenuesDiverses,
          totalRetenuesSalariales: calcResult.totalRetenuesSalariales,
          montantCnssPatronale: calcResult.montantCnssPatronale,
          montantVpsPatronale: calcResult.montantVpsPatronale,
          totalChargesPatronales: calcResult.totalChargesPatronales,
          netImposable: calcResult.netImposable,
          netAPayer: calcResult.netAPayer,
          netApresRetenues: calcResult.netAPayer,
          statut: 'CALCULE',
        },
      });

      // Supprimer anciennes lignes et insérer nouvelles
      await this.prisma.rhBulletinPaieLigne.deleteMany({
        where: { bulletinPaieId: payslip.id },
      });

      await this.prisma.rhBulletinPaieLigne.createMany({
        data: calcResult.detailsLignes.map((l) => ({
          bulletinPaieId: payslip.id,
          codeRubrique: l.codeRubrique,
          libelleRubrique: l.libelleRubrique,
          typeRubrique: l.typeRubrique as any,
          sens: l.sens as any,
          base: l.base,
          taux: l.taux,
          montantGain: l.montantGain,
          montantRetenue: l.montantRetenue,
          partPatronaleMontant: l.partPatronaleMontant,
          ordre: l.ordre,
        })),
      });

      calculatedPayslips.push(payslip);
    }

    // Mettre à jour l'état du cycle
    await this.prisma.rhCyclePaie.update({
      where: { id: cyclePaieId },
      data: { statut: 'CALCULE', dateCalcul: new Date() },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_cycle_paie',
      entiteId: cyclePaieId,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: { action: 'CALCUL_PAIE_MASSE', totalBulletins: calculatedPayslips.length },
    });

    return {
      success: true,
      cycleId: cyclePaieId,
      totalBulletinsCalcules: calculatedPayslips.length,
      bulletins: calculatedPayslips,
    };
  }

  // ---------------- VALIDATION & CLÔTURE ----------------
  async validateCycle(cyclePaieId: string, tenantId: string, userId?: string) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id: cyclePaieId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Cycle de paie introuvable');

    // Passer les bulletins en statut VALIDE
    await this.prisma.rhBulletinPaie.updateMany({
      where: { cyclePaieId, tenantId },
      data: { statut: 'VALIDE' },
    });

    const updated = await this.prisma.rhCyclePaie.update({
      where: { id: cyclePaieId },
      data: {
        statut: 'VALIDE',
        dateValidationFinale: new Date(),
        cloturePar: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_cycle_paie',
      entiteId: cyclePaieId,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: { statut: 'VALIDE' },
    });

    return updated;
  }

  // ---------------- CONSULTATION BULLETINS ----------------
  async getBulletins(
    tenantId: string,
    cyclePaieId?: string,
    employeId?: string,
    annee?: number,
  ) {
    const where: any = {
      tenantId,
      ...(cyclePaieId ? { cyclePaieId } : {}),
      ...(employeId ? { employeId } : {}),
    };

    if (annee) {
      where.cyclePaie = { annee };
    }

    return this.prisma.rhBulletinPaie.findMany({
      where,
      include: {
        employe: true,
        contrat: {
          include: {
            poste: true,
            categorieProfessionnelle: true,
          },
        },
        cyclePaie: {
          include: { etablissement: true },
        },
      },
      orderBy: [{ dateDebutPeriode: 'desc' }, { employe: { nom: 'asc' } }],
    });
  }

  async getBulletinById(id: string, tenantId: string, userId?: string) {
    const bulletin = await this.prisma.rhBulletinPaie.findFirst({
      where: { id, tenantId },
      include: {
        employe: {
          include: {
            coordonneesBancaires: { where: { estComptePrincipal: true } },
          },
        },
        contrat: {
          include: {
            poste: true,
            categorieProfessionnelle: true,
            conventionCollective: true,
          },
        },
        cyclePaie: {
          include: {
            etablissement: { include: { pays: true } },
          },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
        },
      },
    });

    if (!bulletin) {
      throw new NotFoundException(`Bulletin ${id} introuvable`);
    }

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_bulletin_paie',
      entiteId: id,
      actionAudit: 'IMPRESSION_BULLETIN',
    });

    return bulletin;
  }

  // ---------------- RÉMUNÉRATIONS EXCEPTIONNELLES & QUOTIENT ----------------
  async createRemunerationExceptionnelle(
    cyclePaieId: string,
    dto: CreateRemunerationExceptionnelleDto,
    tenantId: string,
  ) {
    // Calculer le salaire moyen des 12 derniers mois
    const pastPayslips = await this.prisma.rhBulletinPaie.findMany({
      where: {
        tenantId,
        employeId: dto.employeId,
        statut: { in: ['VALIDE', 'PAYE'] },
      },
      orderBy: { dateDebutPeriode: 'desc' },
      take: 12,
    });

    let salaireMoyen12m = 0;
    if (pastPayslips.length > 0) {
      const sumBrut = pastPayslips.reduce((sum, b) => sum + b.totalSalaireBrut, 0);
      salaireMoyen12m = Math.round(sumBrut / pastPayslips.length);
    } else {
      const contrat = await this.prisma.rhContrat.findFirst({
        where: { tenantId, employeId: dto.employeId, statut: 'ACTIF' },
      });
      salaireMoyen12m = contrat?.salaireBaseMensuel ?? dto.montantBrut;
    }

    const quotientDetails = this.calculPaieService.calculateQuotientTax(
      salaireMoyen12m,
      dto.montantBrut,
      dto.tauxAbattementApplique ?? 25,
      salaireMoyen12m,
    );

    return this.prisma.rhRemunerationExceptionnelle.create({
      data: {
        tenantId,
        employeId: dto.employeId,
        cyclePaieId,
        typeRemuneration: dto.typeRemuneration,
        montantBrut: dto.montantBrut,
        anneeConcernee: dto.anneeConcernee,
        periodeAcquisitionMois: dto.periodeAcquisitionMois ?? 12,
        salaireMoyenReference12m: salaireMoyen12m,
        impotReference12m: quotientDetails.impotReference12m,
        tauxAbattementApplique: dto.tauxAbattementApplique ?? 25,
        baseApresAbattement: quotientDetails.baseApresAbattement,
        rapportQuotient: quotientDetails.rapportQuotient,
        impotCalculeQuotient: quotientDetails.impotSpecifiqueExceptionnel,
        detailsCalculJson: quotientDetails,
      },
    });
  }

  // ---------------- SOLDE DE TOUT COMPTE ----------------
  async getSoldesToutCompte(tenantId: string, employeId?: string) {
    return this.prisma.rhSoldeToutCompte.findMany({
      where: {
        tenantId,
        ...(employeId ? { employeId } : {}),
      },
      include: {
        employe: true,
        contratRupture: true,
      },
      orderBy: { dateEtablissement: 'desc' },
    });
  }

  async createSoldeToutCompte(dto: CreateSoldeToutCompteDto, tenantId: string) {
    const totalNet = Math.round(
      (dto.montantDernierSalaireNet ?? 0) +
        (dto.montantIndemnitePreavisNet ?? 0) +
        (dto.montantIndemniteLicenciementNet ?? 0) +
        (dto.montantIndemniteCongesPayesNet ?? 0) -
        (dto.montantRetenuesDiverses ?? 0),
    );

    return this.prisma.rhSoldeToutCompte.create({
      data: {
        tenantId,
        employeId: dto.employeId,
        contratRuptureId: dto.contratRuptureId,
        bulletinPaieId: dto.bulletinPaieId,
        dateEtablissement: new Date(dto.dateEtablissement),
        montantDernierSalaireNet: dto.montantDernierSalaireNet ?? 0,
        montantIndemnitePreavisNet: dto.montantIndemnitePreavisNet ?? 0,
        montantIndemniteLicenciementNet: dto.montantIndemniteLicenciementNet ?? 0,
        montantIndemniteCongesPayesNet: dto.montantIndemniteCongesPayesNet ?? 0,
        montantRetenuesDiverses: dto.montantRetenuesDiverses ?? 0,
        montantTotalNet: totalNet,
        recuPourSoldeSigne: false,
        statutSignature: 'EN_ATTENTE_SIGNATURE',
        certificatTravailGenere: true,
      },
    });
  }

  async signerSoldeToutCompte(id: string, dto: SignerSoldeToutCompteDto, tenantId: string) {
    const stc = await this.prisma.rhSoldeToutCompte.findFirst({ where: { id, tenantId } });
    if (!stc) throw new NotFoundException('Solde de tout compte introuvable');

    return this.prisma.rhSoldeToutCompte.update({
      where: { id },
      data: {
        statutSignature: dto.statutSignature,
        recuPourSoldeSigne: dto.recuPourSoldeSigne ?? true,
        dateSignature: new Date(),
        certificatTravailGenere: dto.certificatTravailGenere ?? true,
      },
    });
  }
}
