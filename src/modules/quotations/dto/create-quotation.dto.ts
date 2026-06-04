import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuotationLineDto } from './quotation-line.dto';

export class CreateQuotationDto {
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;

  @IsUUID()
  @IsOptional()
  contactId?: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  exchangeRate?: number;

  @IsUUID()
  @IsOptional()
  paymentTermId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPct?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationLineDto)
  lines!: QuotationLineDto[];
}
