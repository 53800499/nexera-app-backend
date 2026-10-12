import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateEcritureDto } from '../dto/compta.dto';

@Injectable()
export class EcrituresService {
  constructor(private readonly prisma: PrismaService) {}

  async listEcritures(
    tenantId: string,
    filters: {
      journalId?: string;
      exerciceId?: string;
      periodeId?: string;
      statut?: string;
      search?: string;
      dateDebut?: string;
      dateFin?: string;
    },
  ) {
    return (this.prisma as any).comptaEcriture.findMany({
      where: {
        tenantId,
        ...(filters.journalId ? { journalId: filters.journalId } : {}),
        ...(filters.exerciceId ? { exerciceId: filters.exerciceId } : {}),
        ...(filters.periodeId ? { periodeId: filters.periodeId } : {}),
        ...(filters.statut ? { statut: filters.statut } : {}),
        ...(filters.dateDebut || filters.dateFin
          ? {
              dateEcriture: {
                ...(filters.dateDebut ? { gte: new Date(filters.dateDebut) } : {}),
                ...(filters.dateFin ? { lte: new Date(filters.dateFin) } : {}),
              },
            }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { libelle: { contains: filters.search, mode: 'insensitive' } },
                { numEcriture: { contains: filters.search, mode: 'insensitive' } },
                { refPiece: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        journal: true,
        exercice: true,
        periode: true,
        lignes: {
          include: {
            compte: true,
            compteAuxiliaire: true,
          },
          orderBy: { ordre: 'asc' },
        },
      },
      orderBy: [{ dateEcriture: 'desc' }, { creeLe: 'desc' }],
    });
  }

  async getEcritureById(tenantId: string, id: string) {
    const ecriture = await (this.prisma as any).comptaEcriture.findFirst({
      where: { id, tenantId },
      include: {
        journal: true,
        exercice: true,
        periode: true,
        lignes: {
          include: {
            compte: true,
            compteAuxiliaire: true,
            lettrage: true,
          },
          orderBy: { ordre: 'asc' },
        },
        piecesJointes: true,
        validations: { orderBy: { decideLe: 'desc' } },
      },
    });

    if (!ecriture) {
      throw new NotFoundException('Écriture comptable introuvable.');
    }

    return ecriture;
  }

  async createEcriture(tenantId: string, dto: CreateEcritureDto, userId: string) {
    const dateEcriture = new Date(dto.dateEcriture);

    // 1. Trouver l'exercice et la période correspondants
    let exercice: any = null;
    if (dto.exerciceId) {
      exercice = await (this.prisma as any).comptaExercice.findFirst({
        where: { id: dto.exerciceId, tenantId },
      });
    }
    if (!exercice) {
      exercice = await (this.prisma as any).comptaExercice.findFirst({
        where: {
          tenantId,
          dateDebut: { lte: dateEcriture },
          dateFin: { gte: dateEcriture },
        },
      });
    }

    if (!exercice) {
      throw new BadRequestException(
        `Aucun exercice comptable n’est défini pour la date du ${dto.dateEcriture}.`,
      );
    }

    if (exercice.statut === 'ARCHIVE') {
      throw new ForbiddenException('Impossible de saisir une écriture sur un exercice archivé.');
    }

    const y = dateEcriture.getFullYear();
    const m = dateEcriture.getMonth() + 1;
    const anneeMois = `${y}-${m < 10 ? '0' + m : m}`;

    let periode: any = null;
    if (dto.periodeId) {
      periode = await (this.prisma as any).comptaPeriode.findFirst({
        where: { id: dto.periodeId, exerciceId: exercice.id },
      });
    }
    if (!periode) {
      periode = await (this.prisma as any).comptaPeriode.findUnique({
        where: {
          exerciceId_anneeMois: {
            exerciceId: exercice.id,
            anneeMois,
          },
        },
      });
    }

    if (!periode) {
      throw new BadRequestException(`Période ${anneeMois} introuvable pour cet exercice.`);
    }

    if (periode.statut === 'CLOTUREE' && exercice.statut !== 'EN_CLOTURE') {
      throw new ForbiddenException(`La période ${anneeMois} est clôturée. Saisie interdite.`);
    }

    // 2. Contrôle d'équilibre Débit = Crédit sur les lignes renseignées
    const lignesValides = (dto.lignes || []).filter(
      (l) =>
        l.compteId &&
        l.compteId.trim().length > 0 &&
        (Number(l.montantDebit || 0) > 0 || Number(l.montantCredit || 0) > 0),
    );

    if (lignesValides.length < 2) {
      throw new BadRequestException(
        'Une écriture comptable doit comporter au moins 2 lignes renseignées avec un compte valide.',
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of lignesValides) {
      totalDebit += Number(l.montantDebit || 0);
      totalCredit += Number(l.montantCredit || 0);
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      throw new BadRequestException(
        `Écriture déséquilibrée : Total Débit (${totalDebit.toFixed(2)}) != Total Crédit (${totalCredit.toFixed(2)}). Écart : ${diff.toFixed(2)}`,
      );
    }

    const statutInitial = dto.soumettreValidation ? 'EN_ATTENTE_VALIDATION' : 'BROUILLON';
    const refPiece = dto.refPiece ?? dto.pieceRef ?? null;
    const auteurId = userId || 'SYSTEM';

    return (this.prisma as any).comptaEcriture.create({
      data: {
        tenantId,
        exerciceId: exercice.id,
        periodeId: periode.id,
        journalId: dto.journalId,
        dateEcriture,
        refPiece,
        datePiece: dto.datePiece ? new Date(dto.datePiece) : null,
        libelle: dto.libelle,
        statut: statutInitial,
        origine: dto.origine || 'MANUELLE',
        saisiPar: auteurId,
        creePar: auteurId,
        lignes: {
          create: lignesValides.map((l, idx) => ({
            ordre: idx + 1,
            compteId: l.compteId,
            compteAuxiliaireId: l.compteAuxiliaireId || null,
            libelleLigne: l.libelleLigne || dto.libelle,
            montantDebit: Number(l.montantDebit || 0),
            montantCredit: Number(l.montantCredit || 0),
            codeDevise: l.codeDevise || 'XOF',
            sectionAnalytiqueId: l.sectionAnalytiqueId || null,
          })),
        },
      },
      include: {
        lignes: {
          include: { compte: true, compteAuxiliaire: true },
        },
        journal: true,
      },
    });
  }

  async updateEcriture(tenantId: string, id: string, dto: Partial<CreateEcritureDto>, userId: string) {
    const ecriture = await this.getEcritureById(tenantId, id);

    if (ecriture.statut === 'VALIDEE') {
      throw new ForbiddenException(
        'Règle d’intangibilité OHADA : Une écriture validée ne peut plus être modifiée.',
      );
    }

    // Supprimer les anciennes lignes et recréer si de nouvelles lignes sont fournies
    if (dto.lignes && dto.lignes.length > 0) {
      const lignesValides = dto.lignes.filter(
        (l) =>
          l.compteId &&
          l.compteId.trim().length > 0 &&
          (Number(l.montantDebit || 0) > 0 || Number(l.montantCredit || 0) > 0),
      );

      if (lignesValides.length < 2) {
        throw new BadRequestException('Lignes incomplètes ou déséquilibrées (minimum 2 lignes avec compte requises).');
      }

      let totalDebit = 0;
      let totalCredit = 0;
      for (const l of lignesValides) {
        totalDebit += Number(l.montantDebit || 0);
        totalCredit += Number(l.montantCredit || 0);
      }
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new BadRequestException('Lignes déséquilibrées.');
      }

      await (this.prisma as any).comptaEcritureLigne.deleteMany({
        where: { ecritureId: id },
      });

      await (this.prisma as any).comptaEcritureLigne.createMany({
        data: lignesValides.map((l, idx) => ({
          ecritureId: id,
          ordre: idx + 1,
          compteId: l.compteId,
          compteAuxiliaireId: l.compteAuxiliaireId || null,
          libelleLigne: l.libelleLigne || dto.libelle || ecriture.libelle,
          montantDebit: Number(l.montantDebit || 0),
          montantCredit: Number(l.montantCredit || 0),
          codeDevise: l.codeDevise || 'XOF',
          sectionAnalytiqueId: l.sectionAnalytiqueId || null,
        })),
      });
    }

    const refPieceValue = dto.refPiece !== undefined ? dto.refPiece : dto.pieceRef;
    const auteurId = userId || 'SYSTEM';

    return (this.prisma as any).comptaEcriture.update({
      where: { id },
      data: {
        ...(dto.libelle ? { libelle: dto.libelle } : {}),
        ...(refPieceValue !== undefined ? { refPiece: refPieceValue } : {}),
        ...(dto.journalId ? { journalId: dto.journalId } : {}),
        ...(dto.dateEcriture ? { dateEcriture: new Date(dto.dateEcriture) } : {}),
        statut: dto.soumettreValidation ? 'EN_ATTENTE_VALIDATION' : 'BROUILLON',
        modifiePar: auteurId,
      },
      include: {
        lignes: { include: { compte: true, compteAuxiliaire: true } },
      },
    });
  }

  async deleteEcriture(tenantId: string, id: string) {
    const ecriture = await this.getEcritureById(tenantId, id);

    if (ecriture.statut === 'VALIDEE') {
      throw new ForbiddenException(
        'Règle d’intangibilité OHADA : Une écriture validée ne peut pas être supprimée. Seule une contre-passation (extourne) est autorisée.',
      );
    }

    await (this.prisma as any).comptaEcriture.delete({
      where: { id },
    });

    return { success: true, message: 'Écriture supprimée avec succès.' };
  }

  async soumettreValidation(tenantId: string, id: string, userId: string) {
    const ecriture = await this.getEcritureById(tenantId, id);

    if (ecriture.statut !== 'BROUILLON' && ecriture.statut !== 'REJETEE') {
      throw new BadRequestException('Seule une écriture en brouillon ou rejetée peut être soumise à validation.');
    }

    return (this.prisma as any).comptaEcriture.update({
      where: { id },
      data: {
        statut: 'EN_ATTENTE_VALIDATION',
        modifiePar: userId,
      },
      include: {
        lignes: { include: { compte: true, compteAuxiliaire: true } },
      },
    });
  }
}

