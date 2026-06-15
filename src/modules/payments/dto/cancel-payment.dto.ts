import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelPaymentDto {
  @ApiProperty({ description: 'Motif obligatoire (RM-E04)' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
