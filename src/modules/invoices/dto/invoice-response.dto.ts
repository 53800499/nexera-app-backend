import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { InvoiceType } from '../enums/invoice-type.enum';
import {
  InvoiceNormalizationStatus,
  MecefAibType,
} from '../enums/mecef.enum';

export class InvoiceDepositSummaryDto {
  @ApiProperty()
  totalDepositsTtc!: number;

  @ApiProperty({ type: [String] })
  depositInvoiceIds!: string[];
}

export class InvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'FAC-DRAFT-000001' })
  number!: string;

  @ApiProperty({ enum: InvoiceType })
  invoiceType!: InvoiceType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  clientId!: string;

  @ApiPropertyOptional()
  orderId?: string | null;

  @ApiPropertyOptional()
  quotationId?: string | null;

  @ApiPropertyOptional()
  originalInvoiceId?: string | null;

  @ApiProperty({ example: 12000 })
  totalTtc!: number;

  @ApiProperty({ example: 12000 })
  amountDue!: number;

  @ApiProperty({ example: 0 })
  amountPaid!: number;

  @ApiPropertyOptional({ type: InvoiceDepositSummaryDto })
  deposits?: InvoiceDepositSummaryDto;

  @ApiProperty({
    enum: InvoiceNormalizationStatus,
    example: InvoiceNormalizationStatus.NOT_NORMALIZED,
  })
  normalizationStatus!: InvoiceNormalizationStatus;

  @ApiPropertyOptional({ example: 'TEST01000001' })
  mecefNim?: string | null;

  @ApiPropertyOptional({ example: '12/45 FV' })
  mecefCounters?: string | null;

  @ApiPropertyOptional({ example: 'F12A-B34C-D56E-F78G-H90I' })
  mecefCode?: string | null;

  @ApiPropertyOptional({ example: 'https://mecef.impots.bj/verify/...' })
  mecefQrCodeData?: string | null;

  @ApiPropertyOptional()
  mecefTaxGroupTotals?: Record<string, any> | null;

  @ApiProperty({ enum: MecefAibType, example: MecefAibType.NONE })
  mecefAibType!: MecefAibType;

  @ApiProperty({ example: 0 })
  mecefAibAmount!: number;

  @ApiPropertyOptional()
  mecefNormalizedAt?: Date | null;

  @ApiPropertyOptional()
  mecefErrorMessage?: string | null;

  @ApiPropertyOptional()
  originalMecefCode?: string | null;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  items!: InvoiceResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
