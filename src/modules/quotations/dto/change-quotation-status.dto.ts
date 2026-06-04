import { IsEnum, IsNotEmpty } from 'class-validator';
import { QuotationStatus } from '../enums/quotation-status.enum';

const MANUAL_STATUSES = [
  QuotationStatus.VIEWED,
  QuotationStatus.ACCEPTED,
  QuotationStatus.DECLINED,
] as const;

export type ManualQuotationStatus = (typeof MANUAL_STATUSES)[number];

export class ChangeQuotationStatusDto {
  @IsEnum(MANUAL_STATUSES)
  @IsNotEmpty()
  status!: ManualQuotationStatus;
}
