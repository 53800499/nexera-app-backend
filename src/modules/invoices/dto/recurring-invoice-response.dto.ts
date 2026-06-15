import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringFrequency } from '../enums/recurring-frequency.enum';

export class RecurringInvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ description: 'Facture modèle' })
  invoiceId!: string;

  @ApiProperty({ enum: RecurringFrequency })
  frequency!: string;

  @ApiProperty()
  nextExecution!: Date;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  lastGeneratedInvoiceId?: string | null;

  @ApiPropertyOptional()
  lastNotifiedAt?: Date | null;
}
