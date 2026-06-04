import { QuotationEntity } from '../entities/quotation.entity';

export class QuotationDeletedEvent {
  constructor(public readonly quotation: QuotationEntity) {}
}
