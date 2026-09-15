import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateDeclarationTvaDto, CreateLigneTvaDto } from '../dto/fiscalite.dto';

@Injectable()
export class TvaService {
  constructor(private readonly prisma: PrismaService) {}

  async getDeclarations(taxContribuableId: string) {
    return (this.prisma as any).taxDeclarationTva.findMany({
      where: { taxContribuableId },
      include: {
        lignes: true,
      },
      orderBy: { periode: 'desc' },
    });
  }

  async getDeclarationById(id: string) {
    const dec = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: { id },
      include: {
        contribuable: true,
        lignes: {
          include: { evenementSource: true },
        },
      },
    });
    if (!dec) {
      throw new NotFoundException('Déclaration de TVA introuvable.');
    }
    return dec;
  }

  async createDeclaration(dto: CreateDeclarationTvaDto) {
    const existing = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: {
        taxContribuableId_periode: {
          taxContribuableId: dto.taxContribuableId,
          periode: dto.periode,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`Une déclaration existe déjà pour la période ${dto.periode}.`);
    }

    // Récupérer le crédit antérieur de la période précédente si non fourni
    let creditAnterieur = dto.creditTvaAnterieur || 0;
    if (!dto.creditTvaAnterieur) {
      const [year, month] = dto.periode.split('-').map(Number);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevPeriode = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

      const prevDec = await (this.prisma as any).taxDeclarationTva.findFirst({
        where: { taxContribuableId: dto.taxContribuableId, periode: prevPeriode },
      });
      if (prevDec && prevDec.tvaNetteDue < 0) {
        creditAnterieur = Math.abs(prevDec.tvaNetteDue);
      }
    }

    const dec = await (this.prisma as any).taxDeclarationTva.create({
      data: {
        taxContribuableId: dto.taxContribuableId,
        periode: dto.periode,
        dateLimiteLegale: new Date(dto.dateLimiteLegale),
        creditTvaAnterieur: creditAnterieur,
        tvaCollectee: 0,
        tvaDeductible: 0,
        tvaNetteDue: -creditAnterieur,
        statut: 'BROUILLON',
      },
      include: { lignes: true },
    });

    // Alimenter automatiquement depuis les événements sources captés pour cette période (EF-020)
    await this.agregerEvenementsSources(dec.id, dto.taxContribuableId, dto.periode);

    return this.getDeclarationById(dec.id);
  }

  /**
   * Alimentation continue (EF-020) des événements de M2 (ventes/achats) et M5 (frais)
   */
  async agregerEvenementsSources(declarationId: string, taxContribuableId: string, periode: string) {
    const [year, month] = periode.split('-');
    const debutMois = new Date(`${year}-${month}-01T00:00:00.000Z`);
    const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
    const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
    const finMois = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`);

    const evenements = await (this.prisma as any).taxEvenementSource.findMany({
      where: {
        taxContribuableId,
        dateEvenement: { gte: debutMois, lt: finMois },
        statutTraitement: 'RECU',
      },
    });

    for (const ev of evenements) {
      let nature: any = 'VENTE_TAXABLE';
      if (ev.typeEvenement === 'ACHAT_RECU') nature = 'ACHAT_DEDUCTIBLE';
      if (ev.typeEvenement === 'NOTE_FRAIS_APPROUVEE') nature = 'NOTE_FRAIS_DEDUCTIBLE';

      const taux = ev.montantHt && ev.montantTaxe ? Math.round((ev.montantTaxe / ev.montantHt) * 100) : 18;

      await (this.prisma as any).taxDeclarationTvaLigne.create({
        data: {
          taxDeclarationTvaId: declarationId,
          nature,
          tauxApplique: taux || 18,
          baseHorsTaxe: ev.montantHt || 0,
          montantTva: ev.montantTaxe || 0,
          evenementSourceId: ev.id,
        },
      });

      await (this.prisma as any).taxEvenementSource.update({
        where: { id: ev.id },
        data: { statutTraitement: 'INTEGRE_DECLARATION' },
      });
    }

    // Recalculer les totaux de la déclaration
    await this.recalculerTotaux(declarationId);
  }

  async addLigneManuelle(declarationId: string, dto: CreateLigneTvaDto) {
    const dec = await this.getDeclarationById(declarationId);
    if (dec.statut !== 'BROUILLON') {
      throw new BadRequestException('Impossible d’ajouter une ligne à une déclaration validée ou déposée.');
    }

    await (this.prisma as any).taxDeclarationTvaLigne.create({
      data: {
        taxDeclarationTvaId: declarationId,
        nature: dto.nature,
        tauxApplique: dto.tauxApplique,
        baseHorsTaxe: dto.baseHorsTaxe,
        montantTva: dto.montantTva,
      },
    });

    await this.recalculerTotaux(declarationId);
    return this.getDeclarationById(declarationId);
  }

  async recalculerTotaux(declarationId: string) {
    const dec = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: { id: declarationId },
      include: { lignes: true },
    });
    if (!dec) return;

    let totalCollectee = 0;
    let totalDeductible = 0;

    for (const l of dec.lignes) {
      if (l.nature === 'VENTE_TAXABLE') {
        totalCollectee += l.montantTva;
      } else if (
        l.nature === 'ACHAT_DEDUCTIBLE' ||
        l.nature === 'IMPORTATION' ||
        l.nature === 'NOTE_FRAIS_DEDUCTIBLE'
      ) {
        totalDeductible += l.montantTva;
      }
    }

    // Règle EF-021 : TVA Nette Due = TVA Collectée - TVA Déductible - Crédit reporté
    // Si négatif => crédit de TVA reporté
    const tvaNetteDue = totalCollectee - totalDeductible - (dec.creditTvaAnterieur || 0);

    await (this.prisma as any).taxDeclarationTva.update({
      where: { id: declarationId },
      data: {
        tvaCollectee: Math.round(totalCollectee * 100) / 100,
        tvaDeductible: Math.round(totalDeductible * 100) / 100,
        tvaNetteDue: Math.round(tvaNetteDue * 100) / 100,
      },
    });
  }

  async validerDeclaration(id: string) {
    return (this.prisma as any).taxDeclarationTva.update({
      where: { id },
      data: { statut: 'VALIDEE' },
    });
  }

  async marquerPayee(id: string) {
    return (this.prisma as any).taxDeclarationTva.update({
      where: { id },
      data: { statut: 'PAYEE' },
    });
  }
}
