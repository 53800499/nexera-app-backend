import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ReferentielNdfService } from '../referentiel/referentiel-ndf.service';
import { CreateDepenseDto, UpdateDepenseDto } from '../dto/depenses.dto';

@Injectable()
export class DepensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referentielService: ReferentielNdfService,
  ) {}

  async getDepenses(
    tenantId: string,
    params?: {
      ndfRapportFraisId?: string;
      categorieDepenseId?: string;
      statut?: any;
    },
  ) {
    const where: any = { tenantId, isDeleted: false };
    if (params?.ndfRapportFraisId) where.ndfRapportFraisId = params.ndfRapportFraisId;
    if (params?.categorieDepenseId) where.categorieDepenseId = params.categorieDepenseId;
    if (params?.statut) where.statut = params.statut;

    return this.prisma.ndfDepense.findMany({
      where,
      include: {
        categorieDepense: true,
        depenseKilometrique: {
          include: { baremeKilometrique: true },
        },
        depensePerDiem: {
          include: { baremePerDiem: true },
        },
        justificatifs: {
          where: { isDeleted: false },
          include: { extractionsIa: true },
        },
        anomalies: {
          where: { isDeleted: false },
          include: { regleDetection: true },
        },
      },
      orderBy: { dateDepense: 'desc' },
    });
  }

  async getDepenseById(tenantId: string, id: string) {
    const depense = await this.prisma.ndfDepense.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        categorieDepense: true,
        depenseKilometrique: {
          include: { baremeKilometrique: true },
        },
        depensePerDiem: {
          include: { baremePerDiem: true },
        },
        justificatifs: {
          where: { isDeleted: false },
          include: { extractionsIa: true },
        },
        anomalies: {
          where: { isDeleted: false },
          include: { regleDetection: true },
        },
      },
    });

    if (!depense) {
      throw new NotFoundException(`Dépense #${id} introuvable`);
    }

    return depense;
  }

  async createDepense(tenantId: string, dto: CreateDepenseDto) {
    // 1. Vérifier le rapport de frais
    const rapport = await this.prisma.ndfRapportFrais.findFirst({
      where: { id: dto.ndfRapportFraisId, tenantId, isDeleted: false },
    });

    if (!rapport) {
      throw new NotFoundException(`Rapport de frais #${dto.ndfRapportFraisId} introuvable`);
    }

    if (rapport.statut !== 'BROUILLON' && rapport.statut !== 'REJETE') {
      throw new BadRequestException(
        `Impossible d'ajouter une dépense à un rapport avec le statut ${rapport.statut}`,
      );
    }

    // 2. Vérifier la catégorie
    const categorie = await this.prisma.ndfCategorieDepense.findFirst({
      where: { id: dto.categorieDepenseId, isDeleted: false },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${dto.categorieDepenseId} introuvable`);
    }

    // 3. Calculer conversion devise
    const deviseCode = dto.deviseCode || 'XOF';
    let montantDeviseReference = dto.montantTtc;

    if (deviseCode !== 'XOF') {
      const tauxChange = await this.prisma.ndfTauxChange.findFirst({
        where: {
          deviseSource: deviseCode,
          deviseCible: 'XOF',
          isDeleted: false,
        },
        orderBy: { dateCours: 'desc' },
      });
      if (tauxChange) {
        montantDeviseReference = Math.round(dto.montantTtc * tauxChange.taux * 100) / 100;
      }
    }

    // 4. Contrôle seuil espèces légal Bénin (100 000 FCFA - CGI Art. 21)
    const seuilEspeces = await this.referentielService.getSeuilPaiementEspeces('BJ');
    const modePaiement = (dto.modePaiement as any) || 'CARTE_PERSONNELLE';
    const depasseSeuilEspeceLegal =
      modePaiement === 'ESPECES' && montantDeviseReference >= seuilEspeces;

    // 5. Calcul TVA récupérable
    let montantTva = dto.montantTva ?? 0;
    const tauxTvaApplique = dto.tauxTvaApplique ?? (categorie.tvaRecuperableParDefaut ? (categorie.tauxTvaParDefaut ?? 18) : 0);
    if (!dto.montantTva && categorie.tvaRecuperableParDefaut && tauxTvaApplique > 0) {
      montantTva = Math.round((dto.montantTtc * (tauxTvaApplique / (100 + tauxTvaApplique))) * 100) / 100;
    }

    // 6. Création de la dépense
    const depense = await this.prisma.ndfDepense.create({
      data: {
        tenantId,
        ndfRapportFraisId: dto.ndfRapportFraisId,
        categorieDepenseId: dto.categorieDepenseId,
        dateDepense: new Date(dto.dateDepense),
        fournisseurLibelle: dto.fournisseurLibelle || null,
        montantTtc: dto.montantTtc,
        montantTva,
        tauxTvaApplique,
        deviseCode,
        montantDeviseReference,
        modePaiement,
        depasseSeuilEspeceLegal,
        depassePolitique: false,
        statut: 'SAISIE',
      },
    });

    // 7. Création spécifique kilométrique
    if (dto.depenseKilometrique) {
      await this.prisma.ndfDepenseKilometrique.create({
        data: {
          ndfDepenseId: depense.id,
          trajetDepart: dto.depenseKilometrique.trajetDepart,
          trajetArrivee: dto.depenseKilometrique.trajetArrivee,
          distanceKm: dto.depenseKilometrique.distanceKm,
          puissanceFiscaleVehicule: dto.depenseKilometrique.puissanceFiscaleVehicule,
          baremeKilometriqueId: dto.depenseKilometrique.baremeKilometriqueId,
        },
      });
    }

    // 8. Création spécifique Per Diem
    if (dto.depensePerDiem) {
      await this.prisma.ndfDepensePerDiem.create({
        data: {
          ndfDepenseId: depense.id,
          nombreJours: dto.depensePerDiem.nombreJours,
          baremePerDiemId: dto.depensePerDiem.baremePerDiemId,
        },
      });
    }

    // 9. Justificatif joint
    if (dto.justificatifUrl) {
      await this.prisma.ndfJustificatif.create({
        data: {
          tenantId,
          ndfDepenseId: depense.id,
          fichierUrl: dto.justificatifUrl,
          typeFichier: (dto.typeFichier as any) || 'IMAGE',
          statutTraitementIa: 'VALIDE_MANUELLEMENT',
        },
      });
    }

    // 10. Recalculer les totaux du rapport parent
    await this.recalculerTotauxRapport(dto.ndfRapportFraisId);

    return this.getDepenseById(tenantId, depense.id);
  }

  async updateDepense(tenantId: string, id: string, dto: UpdateDepenseDto) {
    const depense = await this.getDepenseById(tenantId, id);

    let montantDeviseReference = dto.montantTtc ?? depense.montantTtc;
    if (depense.deviseCode !== 'XOF' && dto.montantTtc) {
      const tauxChange = await this.prisma.ndfTauxChange.findFirst({
        where: {
          deviseSource: depense.deviseCode,
          deviseCible: 'XOF',
          isDeleted: false,
        },
        orderBy: { dateCours: 'desc' },
      });
      if (tauxChange) {
        montantDeviseReference = Math.round(dto.montantTtc * tauxChange.taux * 100) / 100;
      }
    }

    const modePaiement = (dto.modePaiement as any) ?? depense.modePaiement;
    const seuilEspeces = await this.referentielService.getSeuilPaiementEspeces('BJ');
    const depasseSeuilEspeceLegal =
      modePaiement === 'ESPECES' && montantDeviseReference >= seuilEspeces;

    await this.prisma.ndfDepense.update({
      where: { id: depense.id },
      data: {
        categorieDepenseId: dto.categorieDepenseId ?? depense.categorieDepenseId,
        dateDepense: dto.dateDepense ? new Date(dto.dateDepense) : depense.dateDepense,
        fournisseurLibelle: dto.fournisseurLibelle ?? depense.fournisseurLibelle,
        montantTtc: dto.montantTtc ?? depense.montantTtc,
        montantTva: dto.montantTva ?? depense.montantTva,
        tauxTvaApplique: dto.tauxTvaApplique ?? depense.tauxTvaApplique,
        montantDeviseReference,
        modePaiement,
        depasseSeuilEspeceLegal,
      },
    });

    await this.recalculerTotauxRapport(depense.ndfRapportFraisId);

    return this.getDepenseById(tenantId, depense.id);
  }

  async deleteDepense(tenantId: string, id: string) {
    const depense = await this.getDepenseById(tenantId, id);

    await this.prisma.ndfDepense.update({
      where: { id: depense.id },
      data: { isDeleted: true },
    });

    await this.recalculerTotauxRapport(depense.ndfRapportFraisId);

    return { success: true, message: `Dépense #${id} supprimée` };
  }

  async recalculerTotauxRapport(rapportId: string) {
    const depenses = await this.prisma.ndfDepense.findMany({
      where: { ndfRapportFraisId: rapportId, isDeleted: false },
    });

    const montantTotal = depenses.reduce((acc, d) => acc + d.montantDeviseReference, 0);
    const montantTvaRecuperableTotal = depenses.reduce(
      (acc, d) => acc + (d.montantTva || 0),
      0,
    );

    await this.prisma.ndfRapportFrais.update({
      where: { id: rapportId },
      data: {
        montantTotal: Math.round(montantTotal * 100) / 100,
        montantTvaRecuperableTotal: Math.round(montantTvaRecuperableTotal * 100) / 100,
      },
    });
  }
}
