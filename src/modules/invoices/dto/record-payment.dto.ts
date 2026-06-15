import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentMethodDto {
  wire = 'wire',
  check = 'check',
  cash = 'cash',
  card = 'card',
  other = 'other',
}

export class RecordPaymentDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethodDto, default: PaymentMethodDto.wire })
  @IsEnum(PaymentMethodDto)
  paymentMethod!: PaymentMethodDto;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
