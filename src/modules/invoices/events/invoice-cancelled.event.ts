import { InvoiceEntity } from '../entities/invoice.entity';

export const INVOICE_CANCELLED = 'invoice.cancelled' as const;

export class InvoiceCancelledEvent {
  readonly eventName = INVOICE_CANCELLED;

  constructor(
    public readonly originalInvoice: InvoiceEntity,
    public readonly creditNoteId: string,
    public readonly creditNoteAmount: number,
  ) {}
}
