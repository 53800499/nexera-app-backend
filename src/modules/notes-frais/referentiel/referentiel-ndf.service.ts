import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CalculerIndemniteKmDto,
  CalculerPerDiemDto,
  CreateBaremeKmDto,
  CreateBaremePerDiemDto,
  CreateCategorieDepenseDto,
  CreatePolitiqueDepenseDto,
  UpdateBaremeKmDto,
  UpdateBaremePerDiemDto,
} from '../dto/referentiel.dto';

@Injectable()
export class ReferentielNdfService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // CATÉGORIES DE DÉPENSES
  // ----------------------------------------------------

  async getCategories(paysCode?: string) {
    return this.prisma.ndfCategorieDepense.findMany({
      where: {
        isDeleted: false,
        actif: true,
        OR: [{ paysCode: null }, ...(paysCode ? [{ paysCode }] : [])],
      },
      orderBy: { libelle: 'asc' },
    });
  }

  async createCategorie(dto: CreateCategorieDepenseDto) {
    return this.prisma.ndfCategorieDepense.create({
      data: {
        paysCode: dto.paysCode || null,
        code: dto.code.toUpperCase(),
        libelle: dto.libelle,
        compteSyscohadaDefaut: dto.compteSyscohadaDefaut || '6251',
        tvaRecuperableParDefaut: dto.tvaRecuperableParDefaut ?? true,
        tauxTvaParDefaut: dto.tauxTvaParDefaut ?? 18,
        justificatifObligatoire: dto.justificatifObligatoire ?? true,
      },
    });
  }

  async updateCategorie(id: string, dto: any) {
    const existing = await this.prisma.ndfCategorieDepense.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return this.prisma.ndfCategorieDepense.update({
      where: { id },
      data: {
        ...(dto.libelle !== undefined && { libelle: dto.libelle }),
        ...(dto.compteSyscohadaDefaut !== undefined && { compteSyscohadaDefaut: dto.compteSyscohadaDefaut }),
        ...(dto.tvaRecuperableParDefaut !== undefined && { tvaRecuperableParDefaut: dto.tvaRecuperableParDefaut }),
        ...(dto.tauxTvaParDefaut !== undefined && { tauxTvaParDefaut: dto.tauxTvaParDefaut }),
        ...(dto.justificatifObligatoire !== undefined && { justificatifObligatoire: dto.justificatifObligatoire }),
        ...(dto.actif !== undefined && { actif: dto.actif }),
      },
    });
  }

  async deleteCategorie(id: string) {
    const existing = await this.prisma.ndfCategorieDepense.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return this.prisma.ndfCategorieDepense.update({
      where: { id },
      data: { isDeleted: true, actif: false },
    });
  }

  async seedDefaultCategories() {
    const defaultCats = [
      { code: 'HOTEL', libelle: 'Hôtel & Hébergement', compteSyscohadaDefaut: '6251', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'REPAS', libelle: 'Repas & Restauration d’affaires', compteSyscohadaDefaut: '6257', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'CARBURANT', libelle: 'Carburant & Essence', compteSyscohadaDefaut: '6251', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'PEAGE', libelle: 'Péage, Parking & Stationnement', compteSyscohadaDefaut: '6251', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'TRANSPORT', libelle: 'Transport, Taxi & Billetterie', compteSyscohadaDefaut: '6251', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'FOURNITURES', libelle: 'Fournitures de bureau & Consommables', compteSyscohadaDefaut: '6051', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'TELECOM', libelle: 'Téléphonie & Forfaits Internet', compteSyscohadaDefaut: '6281', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'REPRESENTATION', libelle: 'Réception & Représentation', compteSyscohadaDefaut: '6257', tvaRecuperableParDefaut: false, tauxTvaParDefaut: 18, justificatifObligatoire: true },
      { code: 'AUTRE', libelle: 'Autres dépenses professionnelles', compteSyscohadaDefaut: '6258', tvaRecuperableParDefaut: true, tauxTvaParDefaut: 18, justificatifObligatoire: true },
    ];

    for (const cat of defaultCats) {
      const existing = await this.prisma.ndfCategorieDepense.findFirst({
        where: { code: cat.code, isDeleted: false },
      });
      if (!existing) {
        await this.prisma.ndfCategorieDepense.create({
          data: {
            ...cat,
            paysCode: null,
            actif: true,
          },
        });
      }
    }

    return this.getCategories();
  }

  // ----------------------------------------------------
  // POLITIQUES DE DÉPENSES
  // ----------------------------------------------------

  async getPolitiques(tenantId: string) {
    return this.prisma.ndfPolitiqueDepense.findMany({
      where: { tenantId, isDeleted: false },
      include: { categorieDepense: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPolitique(tenantId: string, dto: CreatePolitiqueDepenseDto) {
    return this.prisma.ndfPolitiqueDepense.create({
      data: {
        tenantId,
        categorieDepenseId: dto.categorieDepenseId,
        paysCode: dto.paysCode || null,
        niveauHierarchique: dto.niveauHierarchique || null,
        plafondMontant: dto.plafondMontant,
        plafondDevise: dto.plafondDevise || 'XOF',
        regleComplementaire: dto.regleComplementaire || null,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
      include: { categorieDepense: true },
    });
  }

  // ----------------------------------------------------
  // BARÈMES KILOMÉTRIQUES & CALCULATEUR
  // ----------------------------------------------------

  async getBaremesKm(paysCode = 'BJ') {
    return this.prisma.ndfBaremeKilometrique.findMany({
      where: { paysCode, isDeleted: false },
      orderBy: [{ typeVehicule: 'asc' }, { puissanceFiscaleMin: 'asc' }],
    });
  }

  async createBaremeKm(dto: CreateBaremeKmDto) {
    return this.prisma.ndfBaremeKilometrique.create({
      data: {
        paysCode: dto.paysCode || 'BJ',
        puissanceFiscaleMin: dto.puissanceFiscaleMin,
        puissanceFiscaleMax: dto.puissanceFiscaleMax ?? null,
        typeVehicule: (dto.typeVehicule as any) || 'VOITURE',
        tauxParKm: dto.tauxParKm,
        deviseCode: dto.deviseCode || 'XOF',
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
        texteReference: dto.texteReference || 'Barème fiscal kilométrique Bénin 2026',
      },
    });
  }

  async updateBaremeKm(id: string, dto: UpdateBaremeKmDto) {
    const existing = await this.prisma.ndfBaremeKilometrique.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Barème kilométrique introuvable');
    }
    return this.prisma.ndfBaremeKilometrique.update({
      where: { id },
      data: {
        ...(dto.puissanceFiscaleMin !== undefined && { puissanceFiscaleMin: dto.puissanceFiscaleMin }),
        ...(dto.puissanceFiscaleMax !== undefined && { puissanceFiscaleMax: dto.puissanceFiscaleMax }),
        ...(dto.typeVehicule !== undefined && { typeVehicule: dto.typeVehicule as any }),
        ...(dto.tauxParKm !== undefined && { tauxParKm: dto.tauxParKm }),
        ...(dto.deviseCode !== undefined && { deviseCode: dto.deviseCode }),
        ...(dto.dateDebutValidite !== undefined && { dateDebutValidite: new Date(dto.dateDebutValidite) }),
        ...(dto.dateFinValidite !== undefined && { dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null }),
        ...(dto.texteReference !== undefined && { texteReference: dto.texteReference }),
      },
    });
  }

  async deleteBaremeKm(id: string) {
    const existing = await this.prisma.ndfBaremeKilometrique.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Barème kilométrique introuvable');
    }
    return this.prisma.ndfBaremeKilometrique.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async seedBaremesKmOfficielBenin() {
    const baremesOfficiels = [
      {
        paysCode: 'BJ',
        puissanceFiscaleMin: 1,
        puissanceFiscaleMax: 6,
        typeVehicule: 'VOITURE' as const,
        tauxParKm: 250,
        deviseCode: 'XOF',
        texteReference: 'Barème fiscal kilométrique Bénin 2026 (<= 6 CV) - CGI Art. 22',
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        puissanceFiscaleMin: 7,
        puissanceFiscaleMax: 10,
        typeVehicule: 'VOITURE' as const,
        tauxParKm: 350,
        deviseCode: 'XOF',
        texteReference: 'Barème fiscal kilométrique Bénin 2026 (7 à 10 CV) - CGI Art. 22',
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        puissanceFiscaleMin: 11,
        puissanceFiscaleMax: null,
        typeVehicule: 'VOITURE' as const,
        tauxParKm: 450,
        deviseCode: 'XOF',
        texteReference: 'Barème fiscal kilométrique Bénin 2026 (> 10 CV) - CGI Art. 22',
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        puissanceFiscaleMin: 1,
        puissanceFiscaleMax: null,
        typeVehicule: 'MOTO' as const,
        tauxParKm: 125,
        deviseCode: 'XOF',
        texteReference: 'Barème kilométrique motos Bénin 2026 - CGI Art. 22',
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    for (const b of baremesOfficiels) {
      const existing = await this.prisma.ndfBaremeKilometrique.findFirst({
        where: {
          paysCode: b.paysCode,
          typeVehicule: b.typeVehicule,
          puissanceFiscaleMin: b.puissanceFiscaleMin,
          isDeleted: false,
        },
      });

      if (existing) {
        await this.prisma.ndfBaremeKilometrique.update({
          where: { id: existing.id },
          data: b,
        });
      } else {
        await this.prisma.ndfBaremeKilometrique.create({
          data: b,
        });
      }
    }

    return this.getBaremesKm('BJ');
  }

  async calculerIndemniteKm(dto: CalculerIndemniteKmDto) {
    const paysCode = dto.paysCode || 'BJ';
    const typeVehicule = dto.typeVehicule || 'VOITURE';

    const baremes = await this.prisma.ndfBaremeKilometrique.findMany({
      where: {
        paysCode,
        typeVehicule: typeVehicule as any,
        isDeleted: false,
      },
      orderBy: { puissanceFiscaleMin: 'asc' },
    });

    if (baremes.length === 0) {
      throw new NotFoundException(
        `Aucun barème kilométrique configuré pour le pays ${paysCode} (${typeVehicule})`,
      );
    }

    const bareme = baremes.find(
      (b) =>
        dto.puissanceFiscale >= b.puissanceFiscaleMin &&
        (b.puissanceFiscaleMax === null || dto.puissanceFiscale <= b.puissanceFiscaleMax),
    );

    if (!bareme) {
      throw new BadRequestException(
        `Aucune tranche de barème trouvée pour ${dto.puissanceFiscale} CV (${typeVehicule})`,
      );
    }

    const montantTotal = Math.round(dto.distanceKm * bareme.tauxParKm * 100) / 100;

    return {
      distanceKm: dto.distanceKm,
      puissanceFiscale: dto.puissanceFiscale,
      typeVehicule: bareme.typeVehicule,
      tauxParKm: bareme.tauxParKm,
      deviseCode: bareme.deviseCode,
      montantTotal,
      baremeKilometriqueId: bareme.id,
      texteReference: bareme.texteReference,
    };
  }

  // ----------------------------------------------------
  // BARÈMES PER DIEM & CALCULATEUR
  // ----------------------------------------------------

  async getBaremesPerDiem(paysCode = 'BJ') {
    return this.prisma.ndfBaremePerDiem.findMany({
      where: { paysCode, isDeleted: false },
      orderBy: { montantJour: 'asc' },
    });
  }

  async createBaremePerDiem(dto: CreateBaremePerDiemDto) {
    return this.prisma.ndfBaremePerDiem.create({
      data: {
        paysCode: dto.paysCode || 'BJ',
        zoneGeographique: dto.zoneGeographique,
        categorieProfessionnelleLibelle: dto.categorieProfessionnelleLibelle || 'TOUTES',
        montantJour: dto.montantJour,
        deviseCode: dto.deviseCode || 'XOF',
        couvreHebergement: dto.couvreHebergement ?? false,
        couvreRestauration: dto.couvreRestauration ?? true,
        dateDebutValidite: new Date(dto.dateDebutValidite),
        dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
      },
    });
  }

  async updateBaremePerDiem(id: string, dto: UpdateBaremePerDiemDto) {
    const existing = await this.prisma.ndfBaremePerDiem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Barème Per Diem introuvable');
    }
    return this.prisma.ndfBaremePerDiem.update({
      where: { id },
      data: {
        ...(dto.zoneGeographique !== undefined && { zoneGeographique: dto.zoneGeographique }),
        ...(dto.categorieProfessionnelleLibelle !== undefined && {
          categorieProfessionnelleLibelle: dto.categorieProfessionnelleLibelle,
        }),
        ...(dto.montantJour !== undefined && { montantJour: dto.montantJour }),
        ...(dto.deviseCode !== undefined && { deviseCode: dto.deviseCode }),
        ...(dto.couvreHebergement !== undefined && { couvreHebergement: dto.couvreHebergement }),
        ...(dto.couvreRestauration !== undefined && { couvreRestauration: dto.couvreRestauration }),
        ...(dto.dateDebutValidite !== undefined && { dateDebutValidite: new Date(dto.dateDebutValidite) }),
        ...(dto.dateFinValidite !== undefined && {
          dateFinValidite: dto.dateFinValidite ? new Date(dto.dateFinValidite) : null,
        }),
      },
    });
  }

  async deleteBaremePerDiem(id: string) {
    const existing = await this.prisma.ndfBaremePerDiem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Barème Per Diem introuvable');
    }
    return this.prisma.ndfBaremePerDiem.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async seedBaremesPerDiemOfficielBenin() {
    const baremesOfficiels = [
      {
        paysCode: 'BJ',
        zoneGeographique: 'Cotonou & Grand Nokoué (Littoral / Atlantique)',
        categorieProfessionnelleLibelle: 'TOUTES',
        montantJour: 35000,
        deviseCode: 'XOF',
        couvreHebergement: false,
        couvreRestauration: true,
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        zoneGeographique: 'Intérieur du Bénin (hors Littoral)',
        categorieProfessionnelleLibelle: 'TOUTES',
        montantJour: 25000,
        deviseCode: 'XOF',
        couvreHebergement: false,
        couvreRestauration: true,
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        zoneGeographique: 'Sous-région UEMOA / CEDEAO',
        categorieProfessionnelleLibelle: 'TOUTES',
        montantJour: 75000,
        deviseCode: 'XOF',
        couvreHebergement: false,
        couvreRestauration: true,
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
      {
        paysCode: 'BJ',
        zoneGeographique: 'International (Hors Afrique de l’Ouest)',
        categorieProfessionnelleLibelle: 'TOUTES',
        montantJour: 150000,
        deviseCode: 'XOF',
        couvreHebergement: false,
        couvreRestauration: true,
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    for (const p of baremesOfficiels) {
      const existing = await this.prisma.ndfBaremePerDiem.findFirst({
        where: {
          paysCode: p.paysCode,
          zoneGeographique: p.zoneGeographique,
          isDeleted: false,
        },
      });

      if (existing) {
        await this.prisma.ndfBaremePerDiem.update({
          where: { id: existing.id },
          data: p,
        });
      } else {
        await this.prisma.ndfBaremePerDiem.create({
          data: p,
        });
      }
    }

    return this.getBaremesPerDiem('BJ');
  }

  async calculerPerDiem(dto: CalculerPerDiemDto) {
    const paysCode = dto.paysCode || 'BJ';

    // 1. Recherche directe par ID si c'est un UUID
    let bareme = await this.prisma.ndfBaremePerDiem.findFirst({
      where: {
        id: dto.zoneGeographique,
        isDeleted: false,
      },
    });

    // 2. Recherche par zone geographique textuelle
    if (!bareme) {
      bareme = await this.prisma.ndfBaremePerDiem.findFirst({
        where: {
          paysCode,
          zoneGeographique: {
            contains: dto.zoneGeographique,
            mode: 'insensitive',
          },
          isDeleted: false,
        },
      });
    }

    // 3. Fallback sur le premier barème actif
    if (!bareme) {
      bareme = await this.prisma.ndfBaremePerDiem.findFirst({
        where: { paysCode, isDeleted: false },
        orderBy: { montantJour: 'asc' },
      });
    }

    if (!bareme) {
      throw new NotFoundException(
        `Aucun barème per diem trouvé pour la zone "${dto.zoneGeographique}" (${paysCode})`,
      );
    }

    const montantTotal = Math.round(dto.nombreJours * bareme.montantJour * 100) / 100;

    return {
      nombreJours: dto.nombreJours,
      zoneGeographique: bareme.zoneGeographique,
      montantJour: bareme.montantJour,
      deviseCode: bareme.deviseCode,
      montantTotal,
      couvreHebergement: bareme.couvreHebergement,
      couvreRestauration: bareme.couvreRestauration,
      baremePerDiemId: bareme.id,
    };
  }

  // ----------------------------------------------------
  // PARAMÈTRES PAYS (Ex: SEUIL ESPÈCES 100 000 FCFA)
  // ----------------------------------------------------

  async getParametresPays(paysCode = 'BJ') {
    return this.prisma.ndfParametrePays.findMany({
      where: { paysCode, isDeleted: false },
      orderBy: { codeParametre: 'asc' },
    });
  }

  async getSeuilPaiementEspeces(paysCode = 'BJ'): Promise<number> {
    const param = await this.prisma.ndfParametrePays.findFirst({
      where: {
        paysCode,
        codeParametre: 'SEUIL_PAIEMENT_ESPECES',
        isDeleted: false,
      },
    });
    return param ? parseFloat(param.valeur) : 100000;
  }
}
