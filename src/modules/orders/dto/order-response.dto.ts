import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderBillingSummaryDto } from './order-billing-summary.dto';
import { OrderQuotationRefDto } from './order-quotation-ref.dto';

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'BC-DRAFT-000001' })
  number!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Lien devis (RM-BC03)' })
  quotationId?: string | null;

  @ApiPropertyOptional({ type: OrderQuotationRefDto })
  quotation?: OrderQuotationRefDto | null;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  issueDate!: Date;

  @ApiProperty({ example: 'EUR' })
  currency!: string;

  @ApiProperty({ example: 10000 })
  subtotalHt!: number;

  @ApiProperty({ example: 2000 })
  totalTax!: number;

  @ApiProperty({ example: 12000 })
  totalTtc!: number;

  @ApiProperty({ type: OrderBillingSummaryDto })
  billing!: OrderBillingSummaryDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  items!: OrderResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class OrderInvoiceCreatedResponseDto {
  @ApiProperty({ description: 'Facture créée' })
  invoice!: Record<string, unknown>;

  @ApiProperty({ type: OrderResponseDto })
  order!: OrderResponseDto;
}

export class OrderMessageResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty()
  orderId!: string;
}
