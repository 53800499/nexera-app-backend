import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceType } from '../enums/invoice-type.enum';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'BC source' })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Devis source' })
  @IsUUID()
  @IsOptional()
  quotationId?: string;

  @ApiProperty({
    enum: InvoiceType,
    default: InvoiceType.STANDARD,
    description: 'standard | proforma | deposit | balance | credit_note',
  })
  @IsEnum(InvoiceType)
  @IsOptional()
  invoiceType?: InvoiceType;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ default: 'EUR', description: 'RM-F06 multi-devises' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ default: 1, description: 'Taux de change à la date facture (RM-F06)' })
  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  exchangeRate?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  paymentTermId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'RM-F07 mentions légales / conditions' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  internalNotes?: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
