import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class EvenementsFiscauxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Capture d'un événement opérationnel porteur d'impact fiscal (M2 ou M5)
   */
  async capturerEvenement(data: {
    moduleSource: 'M2_GESTION_COMMERCIALE' | 'M4_RH_PAIE' | 'M5_NOTES_FRAIS';
    typeEvenement: string;
    referenceObjetSource: string;
    taxContribuableId: string;
    dateEvenement: Date;
    montantHt?: number;
    montantTaxe?: number;
    natureFiscale?: string;
  }) {
    return (this.prisma as any).taxEvenementSource.create({
      data: {
        moduleSource: data.moduleSource,
        typeEvenement: data.typeEvenement,
        referenceObjetSource: data.referenceObjetSource,
        taxContribuableId: data.taxContribuableId,
        dateEvenement: data.dateEvenement,
        montantHt: data.montantHt,
        montantTaxe: data.montantTaxe,
        natureFiscale: data.natureFiscale,
        statutTraitement: 'RECU',
      },
    });
  }

  async getEvenementsRecents(taxContribuableId: string, limit = 50) {
    return (this.prisma as any).taxEvenementSource.findMany({
      where: { taxContribuableId },
      orderBy: { dateEvenement: 'desc' },
      take: limit,
    });
  }
}
