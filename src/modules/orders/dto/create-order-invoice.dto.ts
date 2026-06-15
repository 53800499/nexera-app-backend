import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum OrderInvoiceTypeDto {
  /** Facture standard */
  standard = 'standard',
  /** Acompte (RM-BC02) */
  deposit = 'deposit',
  /** Solde */
  balance = 'balance',
  proforma = 'proforma',
}

export class CreateOrderInvoiceDto {
  @ApiPropertyOptional({
    description:
      'Montant TTC à facturer (RM-BC02). Si omis, facture le reste à facturer.',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amountTtc?: number;

  @ApiPropertyOptional({
    description: 'Pourcentage du reste à facturer (0–100)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  @Max(100)
  billingPct?: number;

  @ApiPropertyOptional({ enum: OrderInvoiceTypeDto, default: 'standard' })
  @IsEnum(OrderInvoiceTypeDto)
  @IsOptional()
  invoiceType?: OrderInvoiceTypeDto;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
