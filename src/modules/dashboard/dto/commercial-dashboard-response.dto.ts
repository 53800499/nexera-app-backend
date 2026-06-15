import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardPeriodDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;
}

export class RevenueKpiDto {
  @ApiProperty({ example: 125000, description: 'CA HT factures émises' })
  revenueHt!: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Variation % vs même période N-1',
  })
  variationPercent!: number | null;

  @ApiProperty({ example: 125000 })
  previousPeriodRevenueHt!: number;
}

export class TopClientDto {
  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  clientName!: string;

  @ApiProperty()
  revenueHt!: number;

  @ApiProperty()
  invoiceCount!: number;
}

export class TopArticleDto {
  @ApiPropertyOptional()
  itemId?: string | null;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  revenueHt!: number;

  @ApiProperty()
  quantity!: number;
}

export class AgedBalanceBucketDto {
  @ApiProperty({ example: '0-30j' })
  label!: string;

  @ApiProperty()
  amountTtc!: number;

  @ApiProperty()
  invoiceCount!: number;
}

export class UpcomingDueInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  clientName!: string;

  @ApiProperty()
  dueDate!: Date;

  @ApiProperty()
  amountDue!: number;

  @ApiProperty()
  daysUntilDue!: number;
}

export class CommercialDashboardResponseDto {
  @ApiProperty({ type: DashboardPeriodDto })
  period!: DashboardPeriodDto;

  @ApiProperty({ type: RevenueKpiDto })
  revenue!: RevenueKpiDto;

  @ApiProperty({ example: 42, description: 'Nombre de factures émises' })
  issuedInvoiceCount!: number;

  @ApiProperty({
    example: 18500,
    description: 'Montant impayés total (factures OVERDUE)',
  })
  totalOverdueAmountTtc!: number;

  @ApiProperty({
    example: 65.5,
    description: 'Taux conversion devis (CONVERTED / envoyés × 100)',
  })
  quotationConversionRate!: number | null;

  @ApiProperty({ type: [TopClientDto] })
  topClients!: TopClientDto[];

  @ApiProperty({ type: [TopArticleDto] })
  topArticles!: TopArticleDto[];

  @ApiProperty({ type: [AgedBalanceBucketDto] })
  agedBalance!: AgedBalanceBucketDto[];

  @ApiProperty({ type: [UpcomingDueInvoiceDto] })
  upcomingDueInvoices!: UpcomingDueInvoiceDto[];
}
