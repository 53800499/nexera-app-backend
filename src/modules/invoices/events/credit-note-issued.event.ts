import { InvoiceEntity } from '../entities/invoice.entity';

export const CREDIT_NOTE_ISSUED = 'credit_note.issued' as const;

export type CreditNoteIssuedLine = {
  itemId?: string | null;
  description: string;
  quantity: number;
  lineTotalHt: number;
  taxAmount: number;
  lineTotalTtc: number;
};

/**
 * §4.2 — avoir créé (partiel ou total).
 * Le module Stocks réintègre le stock (IN_RETURN).
 */
export class CreditNoteIssuedEvent {
  readonly eventName = CREDIT_NOTE_ISSUED;

  constructor(
    public readonly creditNote: InvoiceEntity,
    public readonly originalInvoiceId: string,
    public readonly lines: CreditNoteIssuedLine[],
    public readonly issueDate: Date,
  ) {}
}
