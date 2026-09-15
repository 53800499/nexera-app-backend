import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SimulerCalculAibDto } from '../dto/fiscalite.dto';

@Injectable()
export class AibService {
  constructor(private readonly prisma: PrismaService) {}

  simulerCalcul(dto: SimulerCalculAibDto) {
    // Taux AIB CGI Bénin 2026 Art. 132 :
    // 1% : Importations, achats commerciaux et fournitures de travaux par entreprises immatriculées IFU
    // 3% : Prestations de services réalisées par personnes immatriculées IFU
    // 5% : Achats, fournitures et prestations par personnes non immatriculées à l'IFU
    let taux = 1.0;
    if (dto.natureOperation === 'PRESTATION_SERVICE_IFU') {
      taux = 3.0;
    } else if (dto.natureOperation === 'ACHAT_NON_IMMATRICULE') {
      taux = 5.0;
    }

    const montantRetenu = Math.round((dto.base * (taux / 100)) * 100) / 100;
    const netAPayer = dto.base - montantRetenu;

    return {
      natureOperation: dto.natureOperation,
      base: dto.base,
      tauxApplique: taux,
      montantRetenu,
      netAPayer,
      imputableIs: true,
      referenceLegale: 'CGI Bénin 2026, Art. 130 à 133',
    };
  }

  async getRetenuesSubies(taxContribuableId: string, periode?: string) {
    return (this.prisma as any).taxRetenueAib.findMany({
      where: {
        taxContribuableId,
        ...(periode ? { periodeDeclarative: periode } : {}),
      },
      include: { evenementSource: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecapitulatifAib(taxContribuableId: string, annee = '2026') {
    const retenues = await (this.prisma as any).taxRetenueAib.findMany({
      where: {
        taxContribuableId,
        periodeDeclarative: { startsWith: annee },
      },
    });

    const totalRetenu1 = retenues
      .filter((r: any) => r.tauxApplique === 1)
      .reduce((sum: number, r: any) => sum + r.montantRetenu, 0);

    const totalRetenu3 = retenues
      .filter((r: any) => r.tauxApplique === 3)
      .reduce((sum: number, r: any) => sum + r.montantRetenu, 0);

    const totalRetenu5 = retenues
      .filter((r: any) => r.tauxApplique === 5)
      .reduce((sum: number, r: any) => sum + r.montantRetenu, 0);

    const totalGeneral = totalRetenu1 + totalRetenu3 + totalRetenu5;

    return {
      annee,
      nombreRetenues: retenues.length,
      totalRetenu1,
      totalRetenu3,
      totalRetenu5,
      totalGeneral,
      montantImputableSurIs: totalGeneral,
    };
  }

  async enregistrerRetenue(data: {
    taxContribuableId: string;
    evenementSourceId: string;
    natureOperation: 'IMPORTATION' | 'ACHAT_COMMERCIAL_IFU' | 'PRESTATION_SERVICE_IFU' | 'ACHAT_NON_IMMATRICULE';
    base: number;
    periodeDeclarative: string;
  }) {
    const calcul = this.simulerCalcul({
      natureOperation: data.natureOperation,
      base: data.base,
    });

    return (this.prisma as any).taxRetenueAib.create({
      data: {
        taxContribuableId: data.taxContribuableId,
        evenementSourceId: data.evenementSourceId,
        natureOperation: data.natureOperation,
        tauxApplique: calcul.tauxApplique,
        base: data.base,
        montantRetenu: calcul.montantRetenu,
        periodeDeclarative: data.periodeDeclarative,
        imputableIs: true,
      },
    });
  }
}
