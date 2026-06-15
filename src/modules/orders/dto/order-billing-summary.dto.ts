import { ApiProperty } from '@nestjs/swagger';

/** Suivi de facturation partielle (RM-BC02). */
export class OrderBillingSummaryDto {
  @ApiProperty({ example: 12000 })
  totalTtc!: number;

  @ApiProperty({ example: 4800, description: 'Montant déjà facturé (TTC)' })
  invoicedTtc!: number;

  @ApiProperty({ example: 7200, description: 'Reste à facturer (TTC)' })
  remainingToInvoice!: number;

  @ApiProperty({ example: 40, description: 'Progression de facturation (%)' })
  billingProgressPct!: number;

  @ApiProperty({ example: false })
  isFullyBilled!: boolean;
}
