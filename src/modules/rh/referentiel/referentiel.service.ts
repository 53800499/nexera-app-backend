import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class ReferentielService {
  constructor(private readonly prisma: PrismaService) {}

  // PAYS
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
        },
        tauxChargesSociales: {
          where: { actif: true },
        },
        baremesAvantagesNature: true,
        parametres: true,
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

  // BAREMES ITS
  async getBaremesIts(paysCode?: string) {
    return this.prisma.rhBaremeIts.findMany({
      where: paysCode ? { paysCode } : {},
      include: {
        tranches: {
          orderBy: { numeroTranche: 'asc' },
        },
      },
      orderBy: { dateDebutValidite: 'desc' },
    });
  }

  // CHARGES SOCIALES & PATRONALES
  async getSocialCharges(paysCode?: string) {
    return this.prisma.rhTauxChargeSociale.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        actif: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  // JOURS FERIES
  async getPublicHolidays(paysCode?: string, annee?: number) {
    return this.prisma.rhJourFerie.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        ...(annee ? { annee } : {}),
      },
      orderBy: { dateJour: 'asc' },
    });
  }

  // CONVENTIONS & GRILLES
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

  // PARAMETRES PAYS
  async getCountryParams(paysCode?: string) {
    return this.prisma.rhParametrePays.findMany({
      where: paysCode ? { paysCode } : {},
      orderBy: { codeParametre: 'asc' },
    });
  }

  // TYPES D'ABSENCE
  async getLeaveTypes(paysCode?: string) {
    return this.prisma.rhTypeAbsence.findMany({
      where: {
        ...(paysCode ? { paysCode } : {}),
        actif: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  // CATALOGUE RUBRIQUES PAIE
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
