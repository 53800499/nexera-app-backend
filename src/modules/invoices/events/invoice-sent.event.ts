import { InvoiceEntity } from '../entities/invoice.entity';

export const INVOICE_SENT = 'invoice.sent' as const;

export class InvoiceSentEvent {
  readonly eventName = INVOICE_SENT;

  constructor(
    public readonly invoice: InvoiceEntity,
    public readonly recipientEmail: string | null,
  ) {}
}
