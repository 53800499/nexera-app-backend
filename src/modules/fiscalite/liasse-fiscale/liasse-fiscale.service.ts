import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class LiasseFiscaleService {
  constructor(private readonly prisma: PrismaService) {}

  async getLiasseByExercice(exerciceId: string) {
    return (this.prisma as any).taxLiasseFiscale.findUnique({
      where: { taxExerciceFiscalId: exerciceId },
      include: {
        exerciceFiscal: {
          include: {
            contribuable: true,
            calculIs: true,
            retraitements: true,
          },
        },
        annexes: true,
      },
    });
  }

  async genererLiasse(exerciceId: string, systeme: 'SYSTEME_NORMAL' | 'SMT' = 'SYSTEME_NORMAL') {
    const ex = await (this.prisma as any).taxExerciceFiscal.findUnique({
      where: { id: exerciceId },
      include: { calculIs: true },
    });
    if (!ex) {
      throw new NotFoundException('Exercice fiscal introuvable.');
    }

    const anneeCloture = new Date(ex.dateFin).getFullYear();
    const dateLimite = new Date(`${anneeCloture + 1}-04-30`); // 30 avril

    return (this.prisma as any).taxLiasseFiscale.upsert({
      where: { taxExerciceFiscalId: exerciceId },
      update: {
        typeSystemeComptable: systeme,
        dateLimiteDepot: dateLimite,
        statut: 'GENEREE',
      },
      create: {
        taxExerciceFiscalId: exerciceId,
        typeSystemeComptable: systeme,
        dateLimiteDepot: dateLimite,
        statut: 'GENEREE',
        valideParCabinet: false,
      },
      include: {
        exerciceFiscal: {
          include: {
            calculIs: true,
            retraitements: true,
            contribuable: true,
          },
        },
        annexes: true,
      },
    });
  }

  /**
   * Règle EF-026 : Validation par le cabinet comptable (Espace Cabinet M6)
   */
  async validerParCabinet(liasseId: string) {
    const liasse = await (this.prisma as any).taxLiasseFiscale.findUnique({
      where: { id: liasseId },
    });
    if (!liasse) {
      throw new NotFoundException('Dossier de liasse fiscale introuvable.');
    }

    return (this.prisma as any).taxLiasseFiscale.update({
      where: { id: liasseId },
      data: {
        valideParCabinet: true,
        statut: 'VALIDEE',
      },
    });
  }

  async marquerDeposee(liasseId: string) {
    return (this.prisma as any).taxLiasseFiscale.update({
      where: { id: liasseId },
      data: { statut: 'DEPOSEE' },
    });
  }

  async ajouterAnnexe(liasseId: string, typeAnnexe: string, documentUrl: string) {
    return (this.prisma as any).taxLiasseFiscaleAnnexe.create({
      data: {
        taxLiasseFiscaleId: liasseId,
        typeAnnexe,
        documentUrl,
      },
    });
  }
}
