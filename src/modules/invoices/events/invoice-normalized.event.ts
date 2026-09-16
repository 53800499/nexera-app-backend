import { InvoiceEntity } from '../entities/invoice.entity';

export const INVOICE_NORMALIZED = 'invoice.normalized' as const;

export class InvoiceNormalizedEvent {
  readonly eventName = INVOICE_NORMALIZED;

  constructor(
    public readonly invoice: InvoiceEntity,
    public readonly mecefCode: string,
    public readonly mecefNim: string,
    public readonly mecefCounters: string,
    public readonly normalizedAt: Date,
  ) {}
}
