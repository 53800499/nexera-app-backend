import { QuotationEntity } from '../entities/quotation.entity';

export class QuotationSentEvent {
  constructor(
    public readonly quotation: QuotationEntity,
    public readonly recipientEmail?: string,
  ) {}
}
