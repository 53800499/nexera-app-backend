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
  QualifySourceReglementaireDto,
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

  async getRegimes(paysCode = 'BJ') {
    return (this.prisma as any).taxRegimeImposition.findMany({
      where: { paysCode, isDeleted: false },
      orderBy: { code: 'asc' },
    });
  }
}
