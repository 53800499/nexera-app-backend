import { QuotationEntity } from '../entities/quotation.entity';
import { ConvertQuotationTarget } from '../dto/convert-quotation.dto';

export class QuotationConvertedEvent {
  constructor(
    public readonly quotation: QuotationEntity,
    public readonly target: ConvertQuotationTarget,
    public readonly targetId: string,
  ) {}
}
