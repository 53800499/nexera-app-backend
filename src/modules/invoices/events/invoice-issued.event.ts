import { InvoiceEntity } from '../entities/invoice.entity';

export const INVOICE_ISSUED = 'invoice.issued' as const;

export class InvoiceIssuedEvent {
  readonly eventName = INVOICE_ISSUED;

  constructor(
    public readonly invoice: InvoiceEntity,
    public readonly finalNumber: string,
    public readonly lines: Array<{
      itemId?: string | null;
      description: string;
      quantity: number;
      lineTotalHt: number;
      taxAmount: number;
      lineTotalTtc: number;
    }>,
    public readonly issueDate: Date,
  ) {}
}
