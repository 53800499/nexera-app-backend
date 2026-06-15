import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { InvoiceType } from '../enums/invoice-type.enum';

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
