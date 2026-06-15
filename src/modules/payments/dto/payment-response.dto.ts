import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';
import { AllocationMode } from '../enums/allocation-mode.enum';
import { InvoiceStatus } from '../../invoices/enums/invoice-status.enum';

export class PaymentImputationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiPropertyOptional()
  invoiceNumber?: string;

  @ApiProperty()
  amount!: number;
}

export class ClientAdvanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalAmount!: number;

  @ApiProperty()
  remainingAmount!: number;

  @ApiProperty()
  currency!: string;
}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  clientId!: string;

  @ApiPropertyOptional()
  clientName?: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  exchangeRate!: number;

  @ApiPropertyOptional()
  exchangeGainLoss?: number | null;

  @ApiProperty()
  unallocatedAmount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional()
  reference?: string | null;

  @ApiProperty()
  paymentDate!: Date;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  isCancelled!: boolean;

  @ApiPropertyOptional()
  cancelledAt?: Date | null;

  @ApiPropertyOptional()
  cancelReason?: string | null;

  @ApiProperty({ type: [PaymentImputationResponseDto] })
  imputations!: PaymentImputationResponseDto[];

  @ApiPropertyOptional({ type: ClientAdvanceResponseDto })
  advanceCreated?: ClientAdvanceResponseDto | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  items!: PaymentResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class OpenInvoiceForPaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  issueDate!: Date;

  @ApiPropertyOptional()
  dueDate?: Date | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  totalTtc!: number;

  @ApiProperty()
  amountPaid!: number;

  @ApiProperty()
  amountDue!: number;
}

export class ClientPaymentContextDto {
  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  clientName!: string;

  @ApiProperty()
  defaultCurrency!: string;

  @ApiProperty({ type: [OpenInvoiceForPaymentDto] })
  openInvoices!: OpenInvoiceForPaymentDto[];

  @ApiProperty({ type: [ClientAdvanceResponseDto] })
  availableAdvances!: ClientAdvanceResponseDto[];

  @ApiProperty()
  totalOpenDue!: number;
}
