import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AutresTaxesService {
  constructor(private readonly prisma: PrismaService) {}

  calculerPatente(chiffreAffaires: number, zoneAdministrative = '1ère zone') {
    // CGI Bénin 2026 Art. 202 :
    // 1ère zone : 70 000 FCFA si CA <= 1 milliard, puis +10 000 FCFA par milliard supplémentaire ou fraction
    // 2ème zone : 60 000 FCFA si CA <= 1 milliard, puis +10 000 FCFA par milliard supplémentaire ou fraction
    const isZone1 = zoneAdministrative.includes('1');
    const tarifBase = isZone1 ? 70000 : 60000;
    const trancheBase = 1000000000; // 1 milliard

    let droitFixe = tarifBase;
    if (chiffreAffaires > trancheBase) {
      const excedent = chiffreAffaires - trancheBase;
      const nbMilliardsSup = Math.ceil(excedent / trancheBase);
      droitFixe += nbMilliardsSup * 10000;
    }

    return {
      chiffreAffaires,
      zoneAdministrative,
      tarifBase,
      montantTotalPatente: droitFixe,
      dateLimitePaiement: '30 avril',
      referenceLegale: 'CGI Bénin 2026, Art. 202 à 205',
    };
  }

  async getDeclarationsGeneriques(taxContribuableId: string, taxTypeCode?: string) {
    return (this.prisma as any).taxDeclarationGenerique.findMany({
      where: {
        taxContribuableId,
        ...(taxTypeCode ? { taxType: { code: taxTypeCode } } : {}),
      },
      include: {
        taxType: true,
        baremeApplique: true,
        lignes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async creerDeclarationGenerique(data: {
    taxContribuableId: string;
    taxTypeId: string;
    periodeOuExercice: string;
    baseImposable?: number;
    montantCalcule: number;
    dateLimiteLegale: string;
    libelleLigne?: string;
  }) {
    return (this.prisma as any).taxDeclarationGenerique.create({
      data: {
        taxContribuableId: data.taxContribuableId,
        taxTypeId: data.taxTypeId,
        periodeOuExercice: data.periodeOuExercice,
        baseImposable: data.baseImposable,
        montantCalcule: data.montantCalcule,
        dateLimiteLegale: new Date(data.dateLimiteLegale),
        statut: 'BROUILLON',
        ...(data.libelleLigne
          ? {
              lignes: {
                create: [
                  {
                    libelle: data.libelleLigne,
                    montant: data.montantCalcule,
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        taxType: true,
        lignes: true,
      },
    });
  }
}
