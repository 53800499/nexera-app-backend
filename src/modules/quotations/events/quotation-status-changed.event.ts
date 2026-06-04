import { QuotationEntity } from '../entities/quotation.entity';
import { QuotationStatus } from '../enums/quotation-status.enum';

export class QuotationStatusChangedEvent {
  constructor(
    public readonly quotation: QuotationEntity,
    public readonly previousStatus: QuotationStatus,
    public readonly newStatus: QuotationStatus,
  ) {}
}
