import { QuotationEntity } from '../entities/quotation.entity';

export class QuotationUpdatedEvent {
  constructor(public readonly quotation: QuotationEntity) {}
}
