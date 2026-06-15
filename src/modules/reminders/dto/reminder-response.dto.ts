import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType } from '../enums/reminder-type.enum';
import { ReminderChannel } from '../enums/reminder-channel.enum';

export class ReminderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiPropertyOptional()
  invoiceNumber?: string;

  @ApiProperty()
  clientId!: string;

  @ApiPropertyOptional()
  clientName?: string;

  @ApiProperty({ example: 1 })
  level!: number;

  @ApiProperty({ enum: ReminderType })
  type!: ReminderType;

  @ApiProperty({ enum: ReminderChannel })
  channel!: ReminderChannel;

  @ApiPropertyOptional()
  subject?: string | null;

  @ApiProperty()
  sentAt!: Date;

  @ApiPropertyOptional()
  emailTo?: string | null;

  @ApiPropertyOptional()
  ccEmails?: string | null;

  @ApiPropertyOptional()
  bodySnapshot?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ReminderListResponseDto {
  @ApiProperty({ type: [ReminderResponseDto] })
  items!: ReminderResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ReminderSettingsResponseDto {
  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty({ example: 3 })
  level1DaysAfterDue!: number;

  @ApiProperty({ example: 15 })
  level2DaysAfterDue!: number;

  @ApiProperty({ example: 30 })
  level3DaysAfterDue!: number;

  @ApiProperty()
  level2CopyCommercial!: boolean;

  @ApiProperty()
  level3AlertDirector!: boolean;

  @ApiProperty()
  level3BlockNewOrders!: boolean;

  @ApiPropertyOptional()
  commercialEmail?: string | null;

  @ApiPropertyOptional()
  directorEmail?: string | null;
}

export class PaymentBehaviorSuggestionDto {
  @ApiProperty({ example: 12.5 })
  avgDaysToPay!: number;

  @ApiProperty({ example: 0.65 })
  onTimePaymentRate!: number;

  @ApiProperty({ example: 8 })
  paidInvoicesAnalyzed!: number;

  @ApiProperty({
    type: [String],
    example: [
      'Délai moyen de paiement élevé (+12 j) — envisager niveau 1 à J+7 au lieu de J+3',
    ],
  })
  suggestions!: string[];

  @ApiPropertyOptional({
    description: 'Délais suggérés par l\'analyse (non appliqués automatiquement)',
  })
  suggestedDelays?: {
    level1DaysAfterDue: number;
    level2DaysAfterDue: number;
    level3DaysAfterDue: number;
  };
}

export class ReminderProcessResultDto {
  @ApiProperty()
  processed!: number;

  @ApiProperty()
  sent!: number;

  @ApiProperty()
  skipped!: number;

  @ApiProperty()
  blocked!: number;
}
