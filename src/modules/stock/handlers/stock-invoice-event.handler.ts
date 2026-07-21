import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { INVOICE_ISSUED } from '../../invoices/events/invoice-issued.event';
import { StockExitsService } from '../stock-exits.service';

export type InvoiceIssuedIntegrationPayload = {
  invoiceId: string;
  clientId: string;
  number: string;
  lines: Array<{
    itemId?: string | null;
    description: string;
    quantity: number;
    lineTotalHt: number;
    taxAmount: number;
    lineTotalTtc: number;
  }>;
  issueDate: string | Date;
};

/**
 * RM-OUT03 — écoute invoice.issued et génère une sortie vente automatique.
 */
@Injectable()
export class StockInvoiceEventHandler implements OnModuleInit {
  private readonly logger = new Logger(StockInvoiceEventHandler.name);

  constructor(
    private readonly integrationBus: IntegrationEventBus,
    private readonly stockExitsService: StockExitsService,
  ) {}

  onModuleInit() {
    this.integrationBus.subscribe<InvoiceIssuedIntegrationPayload>(
      INVOICE_ISSUED,
      (event) => this.onInvoiceIssued(event.tenantId, event.payload),
    );
  }

  private async onInvoiceIssued(
    tenantId: string,
    payload: InvoiceIssuedIntegrationPayload,
  ) {
    try {
      const result = await this.stockExitsService.createSaleFromInvoice(
        tenantId,
        {
          invoiceId: payload.invoiceId,
          number: payload.number,
          lines: payload.lines,
          issueDate: payload.issueDate,
        },
      );
      if (result) {
        this.logger.log(
          `[stock] OUT_SALE created for invoice ${payload.number} → ${result.number}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[stock] Failed OUT_SALE for invoice ${payload.number}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
