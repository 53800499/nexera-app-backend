import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationEventBus } from '../../../../shared/events/integration-event.bus';
import { INVOICE_ISSUED } from '../../../invoices/events/invoice-issued.event';
import { INVOICE_CANCELLED } from '../../../invoices/events/invoice-cancelled.event';
import { CREDIT_NOTE_ISSUED } from '../../../invoices/events/credit-note-issued.event';
import { StockExitsService } from '../stock-exits.service';
import { StockMovementsService } from '../stock-movements.service';

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

export type CreditNoteStockPayload = {
  creditNoteId: string;
  creditNoteNumber?: string;
  originalInvoiceId: string;
  lines: Array<{
    itemId?: string | null;
    description: string;
    quantity: number;
  }>;
  issueDate?: string | Date;
  amount?: number;
};

/**
 * §4.2 — écoute invoice.issued / invoice.cancelled / credit_note.issued.
 */
@Injectable()
export class StockInvoiceEventHandler implements OnModuleInit {
  private readonly logger = new Logger(StockInvoiceEventHandler.name);

  constructor(
    private readonly integrationBus: IntegrationEventBus,
    private readonly stockExitsService: StockExitsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  onModuleInit() {
    this.integrationBus.subscribe<InvoiceIssuedIntegrationPayload>(
      INVOICE_ISSUED,
      (event) => this.onInvoiceIssued(event.tenantId, event.payload),
    );
    this.integrationBus.subscribe<CreditNoteStockPayload>(
      INVOICE_CANCELLED,
      (event) => this.onCreditReturn(event.tenantId, event.payload, 'invoice.cancelled'),
    );
    this.integrationBus.subscribe<CreditNoteStockPayload>(
      CREDIT_NOTE_ISSUED,
      (event) => this.onCreditReturn(event.tenantId, event.payload, 'credit_note.issued'),
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

  private async onCreditReturn(
    tenantId: string,
    payload: CreditNoteStockPayload,
    source: string,
  ) {
    try {
      const result = await this.stockMovementsService.createReturnFromCreditNote(
        tenantId,
        {
          creditNoteId: payload.creditNoteId,
          creditNoteNumber: payload.creditNoteNumber ?? payload.creditNoteId,
          originalInvoiceId: payload.originalInvoiceId,
          lines: payload.lines ?? [],
          issueDate: payload.issueDate ?? new Date(),
        },
      );
      if (result) {
        this.logger.log(
          `[stock] IN_RETURN from ${source} creditNote=${payload.creditNoteId} → ${result.number}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[stock] Failed IN_RETURN from ${source} creditNote=${payload.creditNoteId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
