import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';

@Injectable()
export class EvenementsFiscauxService implements OnModuleInit {
  private readonly logger = new Logger(EvenementsFiscauxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly integrationBus?: IntegrationEventBus,
  ) {}

  onModuleInit() {
    if (this.integrationBus) {
      this.integrationBus.subscribe('invoice.issued', async (event: any) => {
        try {
          await this.onInvoiceIssued(event);
        } catch (err: any) {
          this.logger.error(
            `Erreur traitement événement fiscal sur facture : ${err.message}`,
          );
        }
      });
      this.logger.log('EvenementsFiscauxService abonné au bus inter-modules (invoice.issued).');
    }
  }

  private async onInvoiceIssued(event: any) {
    const { tenantId, payload } = event;
    const invoiceId = payload?.invoiceId;
    if (!invoiceId) return;

    const invoice = await (this.prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) return;

    // Récupérer ou trouver le profil contribuable rattaché
    let contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId },
    });
    if (!contribuable) {
      contribuable = await (this.prisma as any).taxContribuable.findFirst();
    }
    if (!contribuable) return;

    await this.capturerEvenement({
      moduleSource: 'M2_GESTION_COMMERCIALE',
      typeEvenement: 'VENTE_VALIDEE',
      referenceObjetSource: invoiceId,
      taxContribuableId: contribuable.id,
      dateEvenement: invoice.issueDate ? new Date(invoice.issueDate) : new Date(),
      montantHt: invoice.totalHt || 0,
      montantTaxe: invoice.totalTax || 0,
      natureFiscale: 'VENTE_TAXABLE',
    });

    this.logger.log(
      `[Fiscalité M7] Événement capté pour facture ${invoice.number} (HT: ${invoice.totalHt}, Taxe: ${invoice.totalTax})`,
    );
  }

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
