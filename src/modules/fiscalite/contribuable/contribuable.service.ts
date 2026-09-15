import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateContribuableDto, UpdateContribuableDto } from '../dto/fiscalite.dto';

@Injectable()
export class ContribuableService {
  constructor(private readonly prisma: PrismaService) {}

  async getContribuableByTenant(tenantId: string) {
    let contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId, isDeleted: false },
      include: {
        pays: true,
        regimeImposition: true,
        options: { orderBy: { dateEffet: 'desc' } },
        etablissementsSecondaires: { where: { isDeleted: false } },
      },
    });

    if (!contribuable) {
      // Auto-provision a default taxpayer profile for the tenant if one doesn't exist
      const regimeReelNormal = await (this.prisma as any).taxRegimeImposition.findFirst({
        where: { code: 'REEL_NORMAL' },
      });

      contribuable = await (this.prisma as any).taxContribuable.create({
        data: {
          tenantId,
          etablissementRefId: tenantId,
          paysCode: 'BJ',
          identifiantFiscalUnique: '3201912345678',
          secteurActivite: 'autres',
          zoneAdministrative: '1ère zone',
          regimeImpositionId: regimeReelNormal?.id || '00000000-0000-0000-0000-000000000001',
          centreImpotsRattachement: 'Centre des Impôts des Moyennes Entreprises de Cotonou',
          assujettiTva: true,
          assujettiIs: true,
        },
        include: {
          pays: true,
          regimeImposition: true,
          options: true,
          etablissementsSecondaires: true,
        },
      });
    }

    return contribuable;
  }

  async updateContribuable(id: string, tenantId: string, dto: UpdateContribuableDto) {
    const existing = await (this.prisma as any).taxContribuable.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Profil fiscal contribuable introuvable.');
    }

    return (this.prisma as any).taxContribuable.update({
      where: { id },
      data: dto,
      include: {
        pays: true,
        regimeImposition: true,
        options: true,
        etablissementsSecondaires: true,
      },
    });
  }

  async addOption(taxContribuableId: string, typeOption: string, dateEffet: string, documentUrl?: string) {
    return (this.prisma as any).taxContribuableOption.create({
      data: {
        taxContribuableId,
        typeOption,
        dateEffet: new Date(dateEffet),
        documentUrl,
      },
    });
  }

  async addEtablissementSecondaire(
    taxContribuableId: string,
    libelle: string,
    zoneAdministrative?: string,
    adresse?: string,
  ) {
    return (this.prisma as any).taxEtablissementSecondaire.create({
      data: {
        taxContribuableId,
        libelle,
        zoneAdministrative,
        adresse,
      },
    });
  }
}
