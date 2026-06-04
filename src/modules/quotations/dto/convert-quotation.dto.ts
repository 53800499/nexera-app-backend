import { IsEnum, IsNotEmpty } from 'class-validator';

export enum ConvertQuotationTarget {
  ORDER = 'order',
  INVOICE = 'invoice',
}

export class ConvertQuotationDto {
  @IsEnum(ConvertQuotationTarget)
  @IsNotEmpty()
  target!: ConvertQuotationTarget;
}
