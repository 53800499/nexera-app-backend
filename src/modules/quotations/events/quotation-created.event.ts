import { QuotationEntity } from '../entities/quotation.entity';

export class QuotationCreatedEvent {
  constructor(public readonly quotation: QuotationEntity) {}
}
