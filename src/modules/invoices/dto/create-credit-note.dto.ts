import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineDto } from './invoice-line.dto';

/** RM-F05 — Avoir lié à une facture d'origine */
export class CreateCreditNoteDto {
  @ApiPropertyOptional({
    description:
      'Montant TTC de l\'avoir (positif, <= solde facture origine). Si omis, utilise les lignes.',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amountTtc?: number;

  @ApiPropertyOptional({ type: [InvoiceLineDto] })
  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
