import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CalculerIndemniteKmDto,
  CalculerPerDiemDto,
  CreateCategorieDepenseDto,
  CreatePolitiqueDepenseDto,
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
      orderBy: { puissanceFiscaleMin: 'asc' },
    });
  }

  async calculerIndemniteKm(dto: CalculerIndemniteKmDto) {
    const paysCode = dto.paysCode || 'BJ';
    const typeVehicule = dto.typeVehicule || 'VOITURE';

    const baremes = await this.prisma.ndfBaremeKilometrique.findMany({
      where: {
        paysCode,
        typeVehicule,
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
        `Aucune tranche de barème trouvée pour ${dto.puissanceFiscale} CV`,
      );
    }

    const montantTotal = Math.round(dto.distanceKm * bareme.tauxParKm * 100) / 100;

    return {
      distanceKm: dto.distanceKm,
      puissanceFiscale: dto.puissanceFiscale,
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
      orderBy: { zoneGeographique: 'asc' },
    });
  }

  async calculerPerDiem(dto: CalculerPerDiemDto) {
    const paysCode = dto.paysCode || 'BJ';

    const bareme = await this.prisma.ndfBaremePerDiem.findFirst({
      where: {
        paysCode,
        zoneGeographique: {
          contains: dto.zoneGeographique,
          mode: 'insensitive',
        },
        isDeleted: false,
      },
    });

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
