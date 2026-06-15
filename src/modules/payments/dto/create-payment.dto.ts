import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../enums/payment-method.enum';
import { AllocationMode } from '../enums/allocation-mode.enum';
import { PaymentImputationDto } from './payment-imputation.dto';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.WIRE })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ example: 'EUR', default: 'EUR' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Taux de change vers la devise de référence (RM-E03)',
  })
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  exchangeRate?: number;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Référence virement, n° chèque, etc.' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    enum: AllocationMode,
    default: AllocationMode.FIFO,
    description:
      'RM-E02 — fifo : facture la plus ancienne en premier ; manual : imputation explicite',
  })
  @IsEnum(AllocationMode)
  allocationMode!: AllocationMode;

  @ApiPropertyOptional({
    type: [PaymentImputationDto],
    description: 'Obligatoire si allocationMode = manual',
  })
  @ValidateIf((dto: CreatePaymentDto) => dto.allocationMode === AllocationMode.MANUAL)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentImputationDto)
  imputations?: PaymentImputationDto[];
}
