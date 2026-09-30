import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateAvantageNatureDto,
  CreateBaremeItsDto,
  CreateBaremeTrancheDto,
  CreateCountryParamDto,
  CreateSocialChargeDto,
  DuplicateBaremeItsDto,
  ReplaceTranchesBatchDto,
  RhAssiettePeriodicityEnum,
  RhAssietteTypeEnum,
  RhBenefitInKindTypeEnum,
  RhCountryParamValueTypeEnum,
  RhItsCalculationModeEnum,
  RhSocialChargeShareEnum,
  SimulateurFiscalDto,
  UpdateAvantageNatureDto,
  UpdateBaremeItsDto,
  UpdateBaremeTrancheDto,
  UpdateCountryParamDto,
  UpdateSocialChargeDto,
} from './dto/baremes-fiscaux.dto';

@Injectable()
export class ReferentielService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // 1. PAYS & ZONES
  // =========================================================================
  async getCountries() {
    return this.prisma.rhPays.findMany({
      where: { actif: true },
      include: {
        zoneReglementaire: true,
      },
      orderBy: { libelle: 'asc' },
    });
  }

  async getCountryByIso(codeIso2: string) {
    const country = await this.prisma.rhPays.findUnique({
      where: { codeIso2 },
      include: {
        zoneReglementaire: true,
        baremesIts: {
          include: {
            tranches: {
              orderBy: { numeroTranche: 'asc' },
            },
          },
          orderBy: { dateDebutValidite: 'desc' },
        },
        tauxChargesSociales: {
          orderBy: { code: 'asc' },
        },
        baremesAvantagesNature: {
          orderBy: { typeAvantage: 'asc' },
        },
        parametres: {
          orderBy: { codeParametre: 'asc' },
        },
        joursFeries: {
          orderBy: { dateJour: 'asc' },
        },
        conventionsCollectives: {
          include: {
            categories: {
              include: {
                grillesSalariales: {
                  orderBy: { dateDebutValidite: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        typesAbsence: {
          where: { actif: true },
        },
        rubriquesPaie: {
          where: { actif: true },
          orderBy: { ordreAffichage: 'asc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException(`Pays ${codeIso2} introuvable`);
    }

    return country;
  }

  // =========================================================================
  // 2. BARÈMES ITS & TRANCHES FISCALES
  // =========================================================================
  async getBaremesIts(paysCode?: string, includeExpired = true) {
    const where: any = {};
    if (paysCode) {
      where.paysCode = paysCode;
    }
    if (!includeExpired) {
      const now = new Date();
      where.OR = [
        { dateFinValidite: null },
        { dateFinValidite: { gte: now } },
      ];
    }

    return this.prisma.rhBaremeIts.findMany({
      where,
      include: {
        tranches: {
          orderBy: { numeroTranche: 'asc' },
        },
        pays: {
          select: {
            codeIso2: true,
            libelle: true,
            deviseCode: true,
          },
        },
      },
      orderBy: { dateDebutValidite: 'desc' },
    });
  }

  async getBaremeItsById(id: string) {
    const bareme = await this.prisma.rhBaremeIts.findUnique({
      where: { id },
      include: {
        tranches: {
          orderBy: { numeroTranche: 'asc' },
        },
        pays: true,
      },
    });

    if (!bareme) {
      throw new NotFoundException(`Barème ITS ID ${id} introuvable`);
    }

    return bareme;
  }

  async createBaremeIts(dto: CreateBaremeItsDto) {
    // Vérifier l'existence du pays
    const pays = await this.prisma.rhPays.findUnique({
      where: { codeIso2: dto.paysCode },
    });
    if (!pays) {
      throw new NotFoundException(`Pays ${dto.paysCode} non trouvé dans le référentiel`);
    }

    return this.prisma.$transaction(async (tx) => {
      const bareme = await tx.rhBaremeIts.create({
        data: {
          paysCode: dto.paysCode,
          codeImpot: dto.codeImpot.toUpperCase(),
          libelle: dto.libelle,
          modeCalcul: dto.modeCalcul as any,
          periodiciteAssiette: (dto.periodiciteAssiette || RhAssiettePeriodicityEnum.MENSUELLE) as any,
          dateDebutValidite: new Date(dto.dateDebutValidite),
          dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
        },
      });

      // Créer les tranches si fournies
      if (dto.tranches && dto.tranches.length > 0) {
        const sortedTranches = [...dto.tranches].sort((a, b) => a.numeroTranche - b.numeroTranche);
        for (const t of sortedTranches) {
          await tx.rhBaremeItsTranche.create({
            data: {
              baremeItsId: bareme.id,
              numeroTranche: t.numeroTranche,
              limiteInferieure: t.limiteInferieure,
              limiteSuperieure: t.limiteSuperieure ?? null,
              taux: t.taux,
              montantDeductionFixe: t.montantDeductionFixe ?? 0,
            },
          });
        }
      }

      return tx.rhBaremeIts.findUnique({
        where: { id: bareme.id },
        include: {
          tranches: { orderBy: { numeroTranche: 'asc' } },
        },
      });
    });
  }

  async updateBaremeIts(id: string, dto: UpdateBaremeItsDto) {
    const existing = await this.prisma.rhBaremeIts.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Barème ITS ID ${id} introuvable`);
    }

    const data: any = {};
    if (dto.libelle !== undefined) data.libelle = dto.libelle;
    if (dto.codeImpot !== undefined) data.codeImpot = dto.codeImpot.toUpperCase();
    if (dto.paysCode !== undefined) data.paysCode = dto.paysCode;
    if (dto.modeCalcul !== undefined) data.modeCalcul = dto.modeCalcul as any;
    if (dto.periodiciteAssiette !== undefined) data.periodiciteAssiette = dto.periodiciteAssiette as any;
    if (dto.dateDebutValidite !== undefined) data.dateDebutValidite = new Date(dto.dateDebutValidite);
    if (dto.dateFinValidite !== undefined) {
      data.dateFinValidite = dto.dateFinValidite ? new Date(dto.dateFinValidite) : null;
    }

    return this.prisma.rhBaremeIts.update({
      where: { id },
      data,
      include: {
        tranches: { orderBy: { numeroTranche: 'asc' } },
      },
    });
  }

  async deleteBaremeIts(id: string) {
    const existing = await this.prisma.rhBaremeIts.findUnique({
      where: { id },
      include: { tranches: true },
    });
    if (!existing) {
      throw new NotFoundException(`Barème ITS ID ${id} introuvable`);
    }

    await this.prisma.rhBaremeIts.delete({
      where: { id },
    });

    return { success: true, message: `Barème ${existing.libelle} supprimé avec succès` };
  }

  async duplicateBaremeIts(id: string, dto: DuplicateBaremeItsDto) {
    const source = await this.getBaremeItsById(id);

    return this.prisma.$transaction(async (tx) => {
      // Clôturer l'ancien barème si nécessaire
      const newStartDate = new Date(dto.nouvelleDateDebut);
      if (!source.dateFinValidite || new Date(source.dateFinValidite) >= newStartDate) {
        const previousDay = new Date(newStartDate.getTime() - 24 * 60 * 60 * 1000);
        await tx.rhBaremeIts.update({
          where: { id: source.id },
          data: { dateFinValidite: previousDay },
        });
      }

      // Créer le nouveau barème
      const newBareme = await tx.rhBaremeIts.create({
        data: {
          paysCode: source.paysCode,
          codeImpot: source.codeImpot,
          libelle: dto.nouveauLibelle,
          modeCalcul: source.modeCalcul,
          periodiciteAssiette: source.periodiciteAssiette,
          dateDebutValidite: newStartDate,
          dateFinValidite: dto.nouvelleDateFin ? new Date(dto.nouvelleDateFin) : null,
        },
      });

      // Dupliquer les tranches
      for (const t of source.tranches) {
        await tx.rhBaremeItsTranche.create({
          data: {
            baremeItsId: newBareme.id,
            numeroTranche: t.numeroTranche,
            limiteInferieure: t.limiteInferieure,
            limiteSuperieure: t.limiteSuperieure,
            taux: t.taux,
            montantDeductionFixe: t.montantDeductionFixe,
          },
        });
      }

      return tx.rhBaremeIts.findUnique({
        where: { id: newBareme.id },
        include: {
          tranches: { orderBy: { numeroTranche: 'asc' } },
        },
      });
    });
  }

  // --- TRANCHES FISCALES ---
  async addBaremeItsTranche(baremeItsId: string, dto: CreateBaremeTrancheDto) {
    const bareme = await this.prisma.rhBaremeIts.findUnique({ where: { id: baremeItsId } });
    if (!bareme) {
      throw new NotFoundException(`Barème ITS ID ${baremeItsId} introuvable`);
    }

    const existingTranche = await this.prisma.rhBaremeItsTranche.findFirst({
      where: { baremeItsId, numeroTranche: dto.numeroTranche },
    });
    if (existingTranche) {
      throw new ConflictException(
        `La tranche numéro ${dto.numeroTranche} existe déjà pour ce barème. Utilisez la modification.`,
      );
    }

    return this.prisma.rhBaremeItsTranche.create({
      data: {
        baremeItsId,
        numeroTranche: dto.numeroTranche,
        limiteInferieure: dto.limiteInferieure,
        limiteSuperieure: dto.limiteSuperieure ?? null,
        taux: dto.taux,
        montantDeductionFixe: dto.montantDeductionFixe ?? 0,
      },
    });
  }

  async updateBaremeItsTranche(trancheId: string, dto: UpdateBaremeTrancheDto) {
    const tranche = await this.prisma.rhBaremeItsTranche.findUnique({ where: { id: trancheId } });
    if (!tranche) {
      throw new NotFoundException(`Tranche fiscale ID ${trancheId} introuvable`);
    }

    const data: any = {};
    if (dto.numeroTranche !== undefined) data.numeroTranche = dto.numeroTranche;
    if (dto.limiteInferieure !== undefined) data.limiteInferieure = dto.limiteInferieure;
    if (dto.limiteSuperieure !== undefined) data.limiteSuperieure = dto.limiteSuperieure;
    if (dto.taux !== undefined) data.taux = dto.taux;
    if (dto.montantDeductionFixe !== undefined) data.montantDeductionFixe = dto.montantDeductionFixe;

    return this.prisma.rhBaremeItsTranche.update({
      where: { id: trancheId },
      data,
    });
  }

  async deleteBaremeItsTranche(trancheId: string) {
    const tranche = await this.prisma.rhBaremeItsTranche.findUnique({ where: { id: trancheId } });
    if (!tranche) {
      throw new NotFoundException(`Tranche fiscale ID ${trancheId} introuvable`);
    }

    await this.prisma.rhBaremeItsTranche.delete({ where: { id: trancheId } });
    return { success: true, message: `Tranche ${tranche.numeroTranche} supprimée` };
  }

  async replaceBaremeItsTranches(baremeItsId: string, dto: ReplaceTranchesBatchDto) {
    const bareme = await this.prisma.rhBaremeIts.findUnique({ where: { id: baremeItsId } });
    if (!bareme) {
      throw new NotFoundException(`Barème ITS ID ${baremeItsId} introuvable`);
    }

    const sortedTranches = [...dto.tranches].sort((a, b) => a.numeroTranche - b.numeroTranche);

    // Validation de continuité
    for (let i = 0; i < sortedTranches.length - 1; i++) {
      const current = sortedTranches[i];
      const next = sortedTranches[i + 1];
      if (current.limiteSuperieure === null || current.limiteSuperieure === undefined) {
        throw new BadRequestException(
          `La tranche ${current.numeroTranche} est illimitée mais est suivie par la tranche ${next.numeroTranche}. Seule la dernière tranche peut avoir une limite supérieure nulle.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Supprimer les tranches actuelles
      await tx.rhBaremeItsTranche.deleteMany({ where: { baremeItsId } });

      // Insérer les nouvelles tranches
      for (const t of sortedTranches) {
        await tx.rhBaremeItsTranche.create({
          data: {
            baremeItsId,
            numeroTranche: t.numeroTranche,
            limiteInferieure: t.limiteInferieure,
            limiteSuperieure: t.limiteSuperieure ?? null,
            taux: t.taux,
            montantDeductionFixe: t.montantDeductionFixe ?? 0,
          },
        });
      }

      return tx.rhBaremeIts.findUnique({
        where: { id: baremeItsId },
        include: {
          tranches: { orderBy: { numeroTranche: 'asc' } },
        },
      });
    });
  }

  // =========================================================================
  // 3. CHARGES SOCIALES & FISCALES PATRONALES (CNSS, VPS)
  // =========================================================================
  async getSocialCharges(paysCode?: string, includeInactive = false) {
    const where: any = {};
    if (paysCode) where.paysCode = paysCode;
    if (!includeInactive) where.actif = true;

    return this.prisma.rhTauxChargeSociale.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async getSocialChargeById(id: string) {
    const charge = await this.prisma.rhTauxChargeSociale.findUnique({ where: { id } });
    if (!charge) {
      throw new NotFoundException(`Cotisation sociale/fiscale ID ${id} introuvable`);
    }
    return charge;
  }

  async createSocialCharge(dto: CreateSocialChargeDto) {
    const existing = await this.prisma.rhTauxChargeSociale.findFirst({
      where: { paysCode: dto.paysCode, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Une charge avec le code "${dto.code}" existe déjà pour le pays ${dto.paysCode}.`,
      );
    }

    return this.prisma.rhTauxChargeSociale.create({
      data: {
        paysCode: dto.paysCode,
        code: dto.code.trim().toUpperCase(),
        libelle: dto.libelle.trim(),
        typeAssiette: (dto.typeAssiette || RhAssietteTypeEnum.SALAIRE_BRUT) as any,
        partSalariale: (dto.partSalariale || RhSocialChargeShareEnum.PATRONALE) as any,
        tauxSalarial: dto.tauxSalarial ?? 0,
        tauxPatronal: dto.tauxPatronal ?? 0,
        montantFixe: dto.montantFixe ?? null,
        plafondMensuel: dto.plafondMensuel ?? null,
        plancherMensuel: dto.plancherMensuel ?? null,
        organismeCollecteur: dto.organismeCollecteur ?? null,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
        actif: dto.actif !== undefined ? dto.actif : true,
      },
    });
  }

  async updateSocialCharge(id: string, dto: UpdateSocialChargeDto) {
    const charge = await this.getSocialChargeById(id);

    const data: any = {};
    if (dto.libelle !== undefined) data.libelle = dto.libelle.trim();
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.paysCode !== undefined) data.paysCode = dto.paysCode;
    if (dto.typeAssiette !== undefined) data.typeAssiette = dto.typeAssiette as any;
    if (dto.partSalariale !== undefined) data.partSalariale = dto.partSalariale as any;
    if (dto.tauxSalarial !== undefined) data.tauxSalarial = dto.tauxSalarial;
    if (dto.tauxPatronal !== undefined) data.tauxPatronal = dto.tauxPatronal;
    if (dto.montantFixe !== undefined) data.montantFixe = dto.montantFixe;
    if (dto.plafondMensuel !== undefined) data.plafondMensuel = dto.plafondMensuel;
    if (dto.plancherMensuel !== undefined) data.plancherMensuel = dto.plancherMensuel;
    if (dto.organismeCollecteur !== undefined) data.organismeCollecteur = dto.organismeCollecteur;
    if (dto.dateDebutValidite !== undefined) data.dateDebutValidite = new Date(dto.dateDebutValidite);
    if (dto.dateFinValidite !== undefined) {
      data.dateFinValidite = dto.dateFinValidite ? new Date(dto.dateFinValidite) : null;
    }
    if (dto.actif !== undefined) data.actif = dto.actif;

    return this.prisma.rhTauxChargeSociale.update({
      where: { id },
      data,
    });
  }

  async deleteSocialCharge(id: string) {
    const charge = await this.getSocialChargeById(id);
    await this.prisma.rhTauxChargeSociale.delete({ where: { id } });
    return { success: true, message: `Charge ${charge.code} supprimée avec succès` };
  }

  // =========================================================================
  // 4. AVANTAGES EN NATURE FORFAITAIRES (CGI Bénin Art. 123)
  // =========================================================================
  async getAvantagesNature(paysCode?: string) {
    const where: any = {};
    if (paysCode) where.paysCode = paysCode;

    return this.prisma.rhBaremeAvantageNature.findMany({
      where,
      orderBy: { typeAvantage: 'asc' },
    });
  }

  async getAvantageNatureById(id: string) {
    const item = await this.prisma.rhBaremeAvantageNature.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Barème avantage en nature ID ${id} introuvable`);
    }
    return item;
  }

  async createAvantageNature(dto: CreateAvantageNatureDto) {
    return this.prisma.rhBaremeAvantageNature.create({
      data: {
        paysCode: dto.paysCode,
        typeAvantage: dto.typeAvantage as any,
        tauxPourcentage: dto.tauxPourcentage ?? null,
        montantFixe: dto.montantFixe ?? null,
        description: dto.description ?? null,
        conditionsJson: dto.conditionsJson ?? null,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
    });
  }

  async updateAvantageNature(id: string, dto: UpdateAvantageNatureDto) {
    await this.getAvantageNatureById(id);

    const data: any = {};
    if (dto.paysCode !== undefined) data.paysCode = dto.paysCode;
    if (dto.typeAvantage !== undefined) data.typeAvantage = dto.typeAvantage as any;
    if (dto.tauxPourcentage !== undefined) data.tauxPourcentage = dto.tauxPourcentage;
    if (dto.montantFixe !== undefined) data.montantFixe = dto.montantFixe;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.conditionsJson !== undefined) data.conditionsJson = dto.conditionsJson;
    if (dto.dateDebutValidite !== undefined) data.dateDebutValidite = new Date(dto.dateDebutValidite);
    if (dto.dateFinValidite !== undefined) {
      data.dateFinValidite = dto.dateFinValidite ? new Date(dto.dateFinValidite) : null;
    }

    return this.prisma.rhBaremeAvantageNature.update({
      where: { id },
      data,
    });
  }

  async deleteAvantageNature(id: string) {
    await this.getAvantageNatureById(id);
    await this.prisma.rhBaremeAvantageNature.delete({ where: { id } });
    return { success: true, message: 'Barème d’avantage en nature supprimé' };
  }

  // =========================================================================
  // 5. PARAMÈTRES RÉGLEMENTAIRES PAYS (SMIG, HS, ORTB...)
  // =========================================================================
  async getCountryParams(paysCode?: string) {
    return this.prisma.rhParametrePays.findMany({
      where: paysCode ? { paysCode } : {},
      orderBy: { codeParametre: 'asc' },
    });
  }

  async getCountryParamById(id: string) {
    const param = await this.prisma.rhParametrePays.findUnique({ where: { id } });
    if (!param) {
      throw new NotFoundException(`Paramètre pays ID ${id} introuvable`);
    }
    return param;
  }

  async createCountryParam(dto: CreateCountryParamDto) {
    return this.prisma.rhParametrePays.create({
      data: {
        paysCode: dto.paysCode,
        codeParametre: dto.codeParametre.trim().toUpperCase(),
        libelle: dto.libelle.trim(),
        typeValeur: dto.typeValeur as any,
        valeurTexte: dto.valeurTexte ?? null,
        valeurNumerique: dto.valeurNumerique ?? null,
        valeurDate: dto.valeurDate ? new Date(dto.valeurDate) : null,
        valeurJson: dto.valeurJson ?? null,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
    });
  }

  async updateCountryParam(id: string, dto: UpdateCountryParamDto) {
    await this.getCountryParamById(id);

    const data: any = {};
    if (dto.paysCode !== undefined) data.paysCode = dto.paysCode;
    if (dto.codeParametre !== undefined) data.codeParametre = dto.codeParametre.trim().toUpperCase();
    if (dto.libelle !== undefined) data.libelle = dto.libelle.trim();
    if (dto.typeValeur !== undefined) data.typeValeur = dto.typeValeur as any;
    if (dto.valeurTexte !== undefined) data.valeurTexte = dto.valeurTexte;
    if (dto.valeurNumerique !== undefined) data.valeurNumerique = dto.valeurNumerique;
    if (dto.valeurDate !== undefined) data.valeurDate = dto.valeurDate ? new Date(dto.valeurDate) : null;
    if (dto.valeurJson !== undefined) data.valeurJson = dto.valeurJson;
    if (dto.dateDebutValidite !== undefined) data.dateDebutValidite = new Date(dto.dateDebutValidite);
    if (dto.dateFinValidite !== undefined) {
      data.dateFinValidite = dto.dateFinValidite ? new Date(dto.dateFinValidite) : null;
    }

    return this.prisma.rhParametrePays.update({
      where: { id },
      data,
    });
  }

  async deleteCountryParam(id: string) {
    await this.getCountryParamById(id);
    await this.prisma.rhParametrePays.delete({ where: { id } });
    return { success: true, message: 'Paramètre pays supprimé avec succès' };
  }

  // =========================================================================
  // 6. SIMULATEUR FISCAL & SOCIAL EN DIRECT (CGI 2026 Bénin)
  // =========================================================================
  async simulateFiscalCalculation(dto: SimulateurFiscalDto) {
    const paysCode = dto.paysCode || 'BJ';
    const inclureCnss = dto.inclureCnss !== false;
    const inclureVps = dto.inclureVps !== false;
    const inclureOrtb = dto.inclureOrtb !== false;
    const mois = dto.mois || 1;

    // 1. Déterminer le barème ITS à appliquer
    let baremeIts: any = null;
    if (dto.baremeItsId) {
      baremeIts = await this.prisma.rhBaremeIts.findUnique({
        where: { id: dto.baremeItsId },
        include: { tranches: { orderBy: { numeroTranche: 'asc' } } },
      });
    }

    if (!baremeIts) {
      baremeIts = await this.prisma.rhBaremeIts.findFirst({
        where: {
          paysCode,
          codeImpot: 'ITS',
        },
        include: { tranches: { orderBy: { numeroTranche: 'asc' } } },
        orderBy: { dateDebutValidite: 'desc' },
      });
    }

    if (!baremeIts || !baremeIts.tranches || baremeIts.tranches.length === 0) {
      throw new BadRequestException(
        `Aucun barème ITS configuré avec tranches pour le pays ${paysCode}.`,
      );
    }

    // 2. Assiettes
    let salaireBrut = dto.salaireBrut ?? 0;
    let netImposable = dto.salaireNetImposable;

    // Cotisation CNSS salariale (3,6% au Bénin)
    let cnssSalariale = 0;
    const TAUX_CNSS_SALARIAL = 3.6;
    if (inclureCnss) {
      if (salaireBrut > 0) {
        cnssSalariale = Math.round(salaireBrut * (TAUX_CNSS_SALARIAL / 100));
      }
    }

    if (netImposable === undefined || netImposable === null) {
      netImposable = Math.max(0, salaireBrut - cnssSalariale);
    } else if (salaireBrut === 0) {
      // Reconstituer un brut approximatif si seul le net imposable a été fourni
      salaireBrut = inclureCnss
        ? Math.round(netImposable / (1 - TAUX_CNSS_SALARIAL / 100))
        : netImposable;
      cnssSalariale = Math.max(0, salaireBrut - netImposable);
    }

    // 3. Calcul progressif par tranches
    const sortedTranches = [...baremeIts.tranches].sort((a: any, b: any) => a.numeroTranche - b.numeroTranche);
    const detailTranches: Array<{
      numeroTranche: number;
      limiteInferieure: number;
      limiteSuperieure: number | null;
      taux: number;
      baseTaxable: number;
      impotTranche: number;
    }> = [];

    let totalIts = 0;
    for (const t of sortedTranches) {
      let portion = 0;
      let impotTranche = 0;

      if (netImposable > t.limiteInferieure) {
        const plafond = t.limiteSuperieure !== null ? t.limiteSuperieure : Infinity;
        portion = Math.min(netImposable, plafond) - t.limiteInferieure;
        if (portion > 0) {
          impotTranche = Math.round(portion * (t.taux / 100));
          totalIts += impotTranche;
        }
      }

      detailTranches.push({
        numeroTranche: t.numeroTranche,
        limiteInferieure: t.limiteInferieure,
        limiteSuperieure: t.limiteSuperieure,
        taux: t.taux,
        baseTaxable: portion,
        impotTranche,
      });
    }

    // 4. Redevance ORTB (CGI Bénin 2026 Art. 125-2)
    // Mars: 1000 FCFA / Juin: 3000 FCFA (exonéré si revenu <= 1ère tranche)
    let redevanceOrtb = 0;
    let motifExonerationOrtb: string | null = null;
    if (inclureOrtb && paysCode === 'BJ') {
      const premiereTrancheSup = sortedTranches[0]?.limiteSuperieure || 50000;
      if (mois === 3) {
        redevanceOrtb = 1000;
      } else if (mois === 6) {
        if (netImposable <= premiereTrancheSup) {
          motifExonerationOrtb = `Exonéré de la redevance ORTB de juin car revenu imposable (≤ ${premiereTrancheSup} FCFA) n'excède pas la 1ère tranche (CGI Art. 125-2)`;
        } else {
          redevanceOrtb = 3000;
        }
      }
    }

    // 5. Charges patronales
    // VPS (4% ou 2% enseignement privé)
    const tauxVps = dto.tauxVps !== undefined ? dto.tauxVps : 4.0;
    const vpsPatronal = inclureVps ? Math.round(salaireBrut * (tauxVps / 100)) : 0;

    // CNSS Patronale (17,4% au total : Prestations Famille 9%, Risques Pro 2%, Retraite 6.4%)
    const TAUX_CNSS_PATRONALE = 17.4;
    const cnssPatronale = inclureCnss ? Math.round(salaireBrut * (TAUX_CNSS_PATRONALE / 100)) : 0;

    // 6. Ratios et Totaux
    const totalRetenuesSalariales = cnssSalariale + totalIts + redevanceOrtb;
    const salaireNetEstime = Math.max(0, salaireBrut - totalRetenuesSalariales);
    const totalChargesPatronales = vpsPatronal + cnssPatronale;
    const coutGlobalEmployeur = salaireBrut + totalChargesPatronales;
    const tauxEffectifMoyen = netImposable > 0 ? Number(((totalIts / netImposable) * 100).toFixed(2)) : 0;

    return {
      simulationDate: new Date().toISOString(),
      baremeApplique: {
        id: baremeIts.id,
        libelle: baremeIts.libelle,
        paysCode: baremeIts.paysCode,
        modeCalcul: baremeIts.modeCalcul,
      },
      parametres: {
        salaireBrut,
        salaireNetImposable: netImposable,
        mois,
        inclureCnss,
        inclureVps,
        inclureOrtb,
        tauxVps,
      },
      decompositionIts: {
        tranches: detailTranches,
        totalIts,
        tauxEffectifMoyen,
      },
      cotisationsSalariales: {
        cnss: cnssSalariale,
        tauxCnss: TAUX_CNSS_SALARIAL,
      },
      redevanceOrtb: {
        montant: redevanceOrtb,
        exoneree: !!motifExonerationOrtb,
        motif: motifExonerationOrtb,
      },
      chargesPatronales: {
        vps: vpsPatronal,
        tauxVps,
        cnss: cnssPatronale,
        tauxCnssPatronale: TAUX_CNSS_PATRONALE,
        totalPatronal: totalChargesPatronales,
      },
      recapitulatif: {
        salaireBrut,
        totalRetenuesSalariales,
        salaireNetEstime,
        totalChargesPatronales,
        coutGlobalEmployeur,
      },
    };
  }

  // =========================================================================
  // 7. JOURS FÉRIÉS & CONVENTIONS COLLECTIVES (Existant)
  // =========================================================================
  async getPublicHolidays(paysCode?: string, annee?: number) {
    return this.prisma.rhJourFerie.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        ...(annee ? { annee } : {}),
      },
      orderBy: { dateJour: 'asc' },
    });
  }

  async getCollectiveAgreements(paysCode?: string) {
    return this.prisma.rhConventionCollective.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        actif: true,
      },
      include: {
        categories: {
          where: { actif: true },
          include: {
            grillesSalariales: {
              orderBy: { dateDebutValidite: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  async getLeaveTypes(paysCode?: string) {
    return this.prisma.rhTypeAbsence.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        actif: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async getPayrollRubrics(paysCode?: string) {
    return this.prisma.rhRubriquePaie.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        actif: true,
      },
      orderBy: { ordreAffichage: 'asc' },
    });
  }
}
