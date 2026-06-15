import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { RecurringFrequency } from '../enums/recurring-frequency.enum';

export class UpdateRecurringInvoiceDto {
  @ApiPropertyOptional({ enum: RecurringFrequency })
  @IsEnum(RecurringFrequency)
  @IsOptional()
  frequency?: RecurringFrequency;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  nextExecution?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
