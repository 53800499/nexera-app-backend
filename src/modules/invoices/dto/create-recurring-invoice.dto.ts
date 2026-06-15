import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { RecurringFrequency } from '../enums/recurring-frequency.enum';

/** RM-F08 — modèle récurrent, génération auto J-7 */
export class CreateRecurringInvoiceDto {
  @ApiProperty({
    enum: RecurringFrequency,
    example: RecurringFrequency.MONTHLY,
  })
  @IsEnum(RecurringFrequency)
  @IsNotEmpty()
  frequency!: RecurringFrequency;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  @IsDateString()
  nextExecution!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
