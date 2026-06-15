import { QuotationEntity } from '../entities/quotation.entity';
import { ConvertQuotationTarget } from '../dto/convert-quotation.dto';

export const QUOTATION_CONVERTED = 'quotation.converted' as const;

export class QuotationConvertedEvent {
  readonly eventName = QUOTATION_CONVERTED;

  constructor(
    public readonly quotation: QuotationEntity,
    public readonly target: ConvertQuotationTarget,
    public readonly targetId: string,
  ) {}
}
