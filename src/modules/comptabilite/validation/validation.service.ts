import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ValidationDecisionDto, ValidationLotDto } from '../dto/compta.dto';

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC-07 : Valider ou rejeter une écriture
   * Règle EF-008 : Le valideur doit être DISTINCT du saisisseur.
   */
  async deciderEcriture(
    tenantId: string,
    ecritureId: string,
    dto: ValidationDecisionDto,
    userId: string,
    lotValidationId?: string,
    isSuperviseurOrAdmin?: boolean,
  ) {
    const ecriture = await (this.prisma as any).comptaEcriture.findFirst({
      where: { id: ecritureId, tenantId },
      include: {
        journal: true,
        exercice: true,
        periode: true,
        lignes: true,
      },
    });

    if (!ecriture) {
      throw new NotFoundException('Écriture comptable introuvable.');
    }

    if (ecriture.statut === 'VALIDEE') {
      throw new BadRequestException('Cette écriture est déjà validée.');
    }

    // Séparation des tâches EF-008
    if (ecriture.saisiPar === userId) {
      let allowed = Boolean(isSuperviseurOrAdmin);
      if (!allowed) {
        const userWithRoles = await (this.prisma as any).user.findUnique({
          where: { id: userId },
          include: { roles: { include: { role: true } } },
        });
        const roles = userWithRoles?.roles?.map((ur: any) => ur.role?.code?.toUpperCase()) || [];
        if (roles.some((r: string) => ['ADMIN', 'CEO', 'SUPER_ADMIN', 'DIRIGEANT', 'CABINET_ADMIN'].includes(r))) {
          allowed = true;
        }
      }

      if (!allowed) {
        throw new ForbiddenException(
          'Règle de séparation des tâches EF-008 : Un utilisateur non-administrateur ne peut pas valider sa propre saisie comptable.',
        );
      }
    }

    if (dto.decision === 'REJETEE') {
      if (!dto.motifRejet) {
        throw new BadRequestException('Le motif de rejet est obligatoire.');
      }

      await (this.prisma as any).comptaValidationHistorique.create({
        data: {
          ecritureId,
          decision: 'REJETEE',
          motifRejet: dto.motifRejet,
          decidePar: userId,
          lotValidationId,
        },
      });

      return (this.prisma as any).comptaEcriture.update({
        where: { id: ecritureId },
        data: { statut: 'REJETEE', modifiePar: userId },
      });
    }

    // Décision = VALIDEE
    // 1. Attribution du numéro séquentiel définitif (format: [CODE_JOURNAL]-[ANNEE]-[NUM_SEQ_5_DIGITS])
    const annee = new Date(ecriture.dateEcriture).getFullYear();
    const countValideesJournal = await (this.prisma as any).comptaEcriture.count({
      where: {
        tenantId,
        journalId: ecriture.journalId,
        exerciceId: ecriture.exerciceId,
        statut: 'VALIDEE',
      },
    });

    const seq = String(countValideesJournal + 1).padStart(5, '0');
    const numEcriture = `${ecriture.journal.codeJournal}-${annee}-${seq}`;

    // 2. Mettre à jour l'écriture
    const updated = await (this.prisma as any).comptaEcriture.update({
      where: { id: ecritureId },
      data: {
        statut: 'VALIDEE',
        numEcriture,
        modifiePar: userId,
      },
      include: {
        lignes: { include: { compte: true, compteAuxiliaire: true } },
        journal: true,
      },
    });

    // 3. Marquer les comptes comme mouvementés (EF-004)
    const compteIds = [...new Set(ecriture.lignes.map((l: any) => l.compteId))];
    await (this.prisma as any).comptaCompte.updateMany({
      where: { id: { in: compteIds } },
      data: { mouvemente: true },
    });

    // 4. Trace dans l'historique de validation
    await (this.prisma as any).comptaValidationHistorique.create({
      data: {
        ecritureId,
        decision: 'VALIDEE',
        decidePar: userId,
        lotValidationId,
      },
    });

    // 5. Mettre à jour le cache de solde compta_solde_periodique
    await this.updateSoldesPeriodiques(tenantId, ecriture.periodeId, ecriture.lignes);

    return updated;
  }

  async validerLot(tenantId: string, dto: ValidationLotDto, userId: string) {
    const lotId = (crypto as any).randomUUID();
    const results: any[] = [];

    for (const ecritureId of dto.ecritureIds) {
      try {
        const res = await this.deciderEcriture(
          tenantId,
          ecritureId,
          { decision: dto.decision, motifRejet: dto.motif },
          userId,
          lotId,
        );
        results.push({ ecritureId, success: true, numEcriture: res.numEcriture });
      } catch (err: any) {
        results.push({ ecritureId, success: false, error: err.message });
      }
    }

    return { lotId, results };
  }

  private async updateSoldesPeriodiques(tenantId: string, periodeId: string, lignes: any[]) {
    for (const l of lignes) {
      const debit = Number(l.montantDebit || 0);
      const credit = Number(l.montantCredit || 0);

      const existingSolde = await (this.prisma as any).comptaSoldePeriodique.findFirst({
        where: {
          compteId: l.compteId,
          periodeId,
          compteAuxiliaireId: l.compteAuxiliaireId || null,
        },
      });

      if (existingSolde) {
        await (this.prisma as any).comptaSoldePeriodique.update({
          where: { id: existingSolde.id },
          data: {
            totalDebit: Number(existingSolde.totalDebit) + debit,
            totalCredit: Number(existingSolde.totalCredit) + credit,
            soldeCumule: Number(existingSolde.soldeCumule) + debit - credit,
            recalculeLe: new Date(),
          },
        });
      } else {
        await (this.prisma as any).comptaSoldePeriodique.create({
          data: {
            tenantId,
            compteId: l.compteId,
            compteAuxiliaireId: l.compteAuxiliaireId || null,
            periodeId,
            totalDebit: debit,
            totalCredit: credit,
            soldeCumule: debit - credit,
            recalculeLe: new Date(),
          },
        });
      }
    }
  }
}
