import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateSourceReglementaireDto,
  CreateTaxBaremeDto,
  CreateTaxParametrePaysDto,
  CreateTaxRegimeDto,
  QualifySourceReglementaireDto,
  UpdateSourceReglementaireDto,
  UpdateTaxBaremeDto,
  UpdateTaxParametrePaysDto,
  UpdateTaxRegimeDto,
  ValidateTaxBaremeDto,
} from '../dto/fiscalite.dto';

@Injectable()
export class ReferentielFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // PAYS ET CONFIGURATION FISCALE NATIONALE
  // ----------------------------------------------------

  async getPays() {
    return (this.prisma as any).taxPays.findMany({
      where: { actif: true },
      include: {
        types: { where: { actif: true } },
        regimes: { where: { isDeleted: false } },
      },
    });
  }

  // ----------------------------------------------------
  // CATALOGUE DES TYPES D'IMPÔTS
  // ----------------------------------------------------

  async getTypes(paysCode = 'BJ') {
    return (this.prisma as any).taxType.findMany({
      where: { paysCode, actif: true, isDeleted: false },
      include: {
        baremes: {
          where: { isDeleted: false },
          include: { tranches: { orderBy: { ordre: 'asc' } } },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  // ----------------------------------------------------
  // BARÈMES FISCAUX ET WORKFLOW DE DOUBLE VALIDATION (EF-008)
  // ----------------------------------------------------

  async getBaremes(taxTypeId?: string, paysCode = 'BJ') {
    return (this.prisma as any).taxBareme.findMany({
      where: {
        isDeleted: false,
        ...(taxTypeId ? { taxTypeId } : {}),
        taxType: { paysCode },
      },
      include: {
        taxType: true,
        sourceReglementaire: true,
        tranches: { orderBy: { ordre: 'asc' } },
      },
      orderBy: { dateDebutValidite: 'desc' },
    });
  }

  async createBareme(dto: CreateTaxBaremeDto, userId: string) {
    const source = await (this.prisma as any).taxSourceReglementaire.findUnique({
      where: { id: dto.sourceReglementaireId },
    });
    if (!source) {
      throw new NotFoundException('Source réglementaire introuvable.');
    }

    return (this.prisma as any).taxBareme.create({
      data: {
        taxTypeId: dto.taxTypeId,
        sourceReglementaireId: dto.sourceReglementaireId,
        libelle: dto.libelle,
        secteurActivite: dto.secteurActivite,
        tauxDefaut: dto.tauxDefaut,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
        statut: 'BROUILLON',
      },
    });
  }

  async updateBareme(id: string, dto: UpdateTaxBaremeDto) {
    const bareme = await (this.prisma as any).taxBareme.findUnique({
      where: { id },
    });
    if (!bareme) {
      throw new NotFoundException('Barème introuvable.');
    }

    return (this.prisma as any).taxBareme.update({
      where: { id },
      data: {
        ...(dto.libelle ? { libelle: dto.libelle } : {}),
        ...(dto.secteurActivite !== undefined ? { secteurActivite: dto.secteurActivite } : {}),
        ...(dto.tauxDefaut !== undefined ? { tauxDefaut: dto.tauxDefaut } : {}),
        ...(dto.dateDebutValidite ? { dateDebutValidite: new Date(dto.dateDebutValidite) } : {}),
        ...(dto.dateFinValidite !== undefined
          ? { dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null }
          : {}),
        ...(dto.sourceReglementaireId ? { sourceReglementaireId: dto.sourceReglementaireId } : {}),
        ...(dto.statut ? { statut: dto.statut } : {}),
      },
      include: {
        taxType: true,
        sourceReglementaire: true,
        tranches: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async duplicateBareme(id: string, newDateDebut?: string) {
    const existing = await (this.prisma as any).taxBareme.findUnique({
      where: { id },
      include: { tranches: true },
    });
    if (!existing) {
      throw new NotFoundException('Barème introuvable.');
    }

    const created = await (this.prisma as any).taxBareme.create({
      data: {
        taxTypeId: existing.taxTypeId,
        sourceReglementaireId: existing.sourceReglementaireId,
        libelle: `${existing.libelle} (Copie)`,
        secteurActivite: existing.secteurActivite,
        tauxDefaut: existing.tauxDefaut,
        dateDebutValidite: newDateDebut ? new Date(newDateDebut) : new Date(),
        dateFinValidite: existing.dateFinValidite,
        statut: 'BROUILLON',
      },
    });

    if (existing.tranches && existing.tranches.length > 0) {
      for (const t of existing.tranches) {
        await (this.prisma as any).taxBaremeTranche.create({
          data: {
            taxBaremeId: created.id,
            ordre: t.ordre,
            critereSecondaire: t.critereSecondaire,
            borneMin: t.borneMin,
            borneMax: t.borneMax,
            taux: t.taux,
            montantFixe: t.montantFixe,
          },
        });
      }
    }

    return (this.prisma as any).taxBareme.findUnique({
      where: { id: created.id },
      include: {
        taxType: true,
        sourceReglementaire: true,
        tranches: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async deleteBareme(id: string) {
    const bareme = await (this.prisma as any).taxBareme.findUnique({
      where: { id },
    });
    if (!bareme) {
      throw new NotFoundException('Barème introuvable.');
    }

    await (this.prisma as any).taxBareme.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { success: true, message: 'Barème supprimé avec succès.' };
  }

  /**
   * Règle EF-008 : Le validateur doit être DISTINCT de l'utilisateur qui a saisi le barème.
   */
  async validerBareme(baremeId: string, validatorUserId: string, dto: ValidateTaxBaremeDto) {
    const bareme = await (this.prisma as any).taxBareme.findUnique({
      where: { id: baremeId },
      include: { sourceReglementaire: true },
    });

    if (!bareme) {
      throw new NotFoundException('Barème fiscal introuvable.');
    }

    if (bareme.statut === 'ACTIF') {
      throw new BadRequestException('Ce barème est déjà actif.');
    }

    // Double contrôle : un même utilisateur ne peut pas valider sa propre saisie si enregistré
    if (bareme.sourceReglementaire?.saisiParUtilisateurId === validatorUserId) {
      throw new ForbiddenException(
        'Règle de séparation EF-008 : La validation d’un barème fiscal doit être effectuée par un utilisateur distinct du créateur.',
      );
    }

    // Mettre à jour le barème en ACTIF
    const updated = await (this.prisma as any).taxBareme.update({
      where: { id: baremeId },
      data: {
        statut: 'ACTIF',
        valideParUtilisateurId: validatorUserId,
      },
    });

    // Journalisation dédiée dans tax_journal_modification_bareme
    await (this.prisma as any).taxJournalModificationBareme.create({
      data: {
        tableModifiee: 'tax_bareme',
        enregistrementId: baremeId,
        sourceReglementaireId: bareme.sourceReglementaireId,
        saisiParUtilisateurId: bareme.sourceReglementaire?.saisiParUtilisateurId || validatorUserId,
        valideParUtilisateurId: validatorUserId,
        aNecessiteRecalculRetroactif: dto.aNecessiteRecalculRetroactif ?? false,
      },
    });

    return updated;
  }

  // ----------------------------------------------------
  // SOURCES RÉGLEMENTAIRES ET VEILLE
  // ----------------------------------------------------

  async getSources(paysCode = 'BJ', statutVeille?: string) {
    return (this.prisma as any).taxSourceReglementaire.findMany({
      where: {
        paysCode,
        isDeleted: false,
        ...(statutVeille ? { statutVeille } : {}),
      },
      include: {
        baremes: true,
        parametres: true,
      },
      orderBy: { datePublication: 'desc' },
    });
  }

  async createSource(dto: CreateSourceReglementaireDto, userId: string) {
    return (this.prisma as any).taxSourceReglementaire.create({
      data: {
        paysCode: dto.paysCode,
        typeSource: dto.typeSource,
        reference: dto.reference,
        titre: dto.titre,
        datePublication: new Date(dto.datePublication),
        dateEntreeVigueur: new Date(dto.dateEntreeVigueur),
        resume: dto.resume,
        statutVeille: 'A_QUALIFIER',
        saisiParUtilisateurId: userId,
      },
    });
  }

  async updateSource(id: string, dto: UpdateSourceReglementaireDto) {
    const source = await (this.prisma as any).taxSourceReglementaire.findUnique({
      where: { id },
    });
    if (!source) {
      throw new NotFoundException('Source réglementaire introuvable.');
    }

    return (this.prisma as any).taxSourceReglementaire.update({
      where: { id },
      data: {
        ...(dto.reference ? { reference: dto.reference } : {}),
        ...(dto.titre ? { titre: dto.titre } : {}),
        ...(dto.typeSource ? { typeSource: dto.typeSource } : {}),
        ...(dto.datePublication ? { datePublication: new Date(dto.datePublication) } : {}),
        ...(dto.dateEntreeVigueur ? { dateEntreeVigueur: new Date(dto.dateEntreeVigueur) } : {}),
        ...(dto.resume !== undefined ? { resume: dto.resume } : {}),
        ...(dto.statutVeille ? { statutVeille: dto.statutVeille } : {}),
      },
    });
  }

  async deleteSource(id: string) {
    const source = await (this.prisma as any).taxSourceReglementaire.findUnique({
      where: { id },
    });
    if (!source) {
      throw new NotFoundException('Source introuvable.');
    }

    await (this.prisma as any).taxSourceReglementaire.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { success: true, message: 'Source supprimée avec succès.' };
  }

  async qualifierSource(sourceId: string, dto: QualifySourceReglementaireDto) {
    const source = await (this.prisma as any).taxSourceReglementaire.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new NotFoundException('Source réglementaire introuvable.');
    }

    return (this.prisma as any).taxSourceReglementaire.update({
      where: { id: sourceId },
      data: {
        statutVeille: dto.statutVeille,
        ...(dto.resume ? { resume: dto.resume } : {}),
      },
    });
  }

  // ----------------------------------------------------
  // PARAMÈTRES PAYS & SEUILS
  // ----------------------------------------------------

  async getParametresPays(paysCode = 'BJ') {
    return (this.prisma as any).taxParametrePays.findMany({
      where: { paysCode },
      include: { sourceReglementaire: true },
      orderBy: { codeParametre: 'asc' },
    });
  }

  async createParametrePays(dto: CreateTaxParametrePaysDto) {
    return (this.prisma as any).taxParametrePays.create({
      data: {
        paysCode: dto.paysCode,
        codeParametre: dto.codeParametre,
        libelle: dto.libelle,
        typeValeur: dto.typeValeur || 'NUMERIQUE',
        valeur: dto.valeur,
        unite: dto.unite,
        sourceReglementaireId: dto.sourceReglementaireId,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
      include: { sourceReglementaire: true },
    });
  }

  async updateParametrePays(id: string, dto: UpdateTaxParametrePaysDto) {
    const param = await (this.prisma as any).taxParametrePays.findUnique({
      where: { id },
    });
    if (!param) {
      throw new NotFoundException('Paramètre introuvable.');
    }

    return (this.prisma as any).taxParametrePays.update({
      where: { id },
      data: {
        ...(dto.libelle ? { libelle: dto.libelle } : {}),
        ...(dto.typeValeur ? { typeValeur: dto.typeValeur } : {}),
        ...(dto.valeur !== undefined ? { valeur: dto.valeur } : {}),
        ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
        ...(dto.sourceReglementaireId !== undefined ? { sourceReglementaireId: dto.sourceReglementaireId } : {}),
        ...(dto.dateDebutValidite ? { dateDebutValidite: new Date(dto.dateDebutValidite) } : {}),
        ...(dto.dateFinValidite !== undefined
          ? { dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null }
          : {}),
      },
      include: { sourceReglementaire: true },
    });
  }

  async deleteParametrePays(id: string) {
    const param = await (this.prisma as any).taxParametrePays.findUnique({
      where: { id },
    });
    if (!param) {
      throw new NotFoundException('Paramètre introuvable.');
    }

    await (this.prisma as any).taxParametrePays.delete({
      where: { id },
    });

    return { success: true, message: 'Paramètre supprimé avec succès.' };
  }

  // ----------------------------------------------------
  // RÉGIMES D'IMPOSITION
  // ----------------------------------------------------

  async getRegimes(paysCode = 'BJ') {
    return (this.prisma as any).taxRegimeImposition.findMany({
      where: { paysCode, isDeleted: false },
      orderBy: { code: 'asc' },
    });
  }

  async createRegime(dto: CreateTaxRegimeDto) {
    return (this.prisma as any).taxRegimeImposition.create({
      data: {
        paysCode: dto.paysCode,
        code: dto.code,
        libelle: dto.libelle,
        seuilChiffreAffairesMax: dto.seuilChiffreAffairesMax,
        obligationComptable: dto.obligationComptable || 'COMPTABILITE_SIMPLIFIEE',
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
    });
  }

  async updateRegime(id: string, dto: UpdateTaxRegimeDto) {
    const regime = await (this.prisma as any).taxRegimeImposition.findUnique({
      where: { id },
    });
    if (!regime) {
      throw new NotFoundException('Régime introuvable.');
    }

    return (this.prisma as any).taxRegimeImposition.update({
      where: { id },
      data: {
        ...(dto.libelle ? { libelle: dto.libelle } : {}),
        ...(dto.seuilChiffreAffairesMax !== undefined ? { seuilChiffreAffairesMax: dto.seuilChiffreAffairesMax } : {}),
        ...(dto.obligationComptable ? { obligationComptable: dto.obligationComptable } : {}),
        ...(dto.dateDebutValidite ? { dateDebutValidite: new Date(dto.dateDebutValidite) } : {}),
        ...(dto.dateFinValidite !== undefined
          ? { dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null }
          : {}),
      },
    });
  }

  async deleteRegime(id: string) {
    const regime = await (this.prisma as any).taxRegimeImposition.findUnique({
      where: { id },
    });
    if (!regime) {
      throw new NotFoundException('Régime introuvable.');
    }

    await (this.prisma as any).taxRegimeImposition.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { success: true, message: 'Régime d\'imposition supprimé avec succès.' };
  }
}
