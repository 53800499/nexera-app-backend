import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum StockEntryTypeDto {
  IN_SUPPLIER = 'IN_SUPPLIER',
  IN_RETURN = 'IN_RETURN',
  IN_PRODUCTION = 'IN_PRODUCTION',
  IN_ADJUSTMENT = 'IN_ADJUSTMENT',
  IN_INITIAL = 'IN_INITIAL',
}

export enum StockQualityStatusDto {
  accepted = 'accepted',
  partial = 'partial',
  rejected = 'rejected',
}

export class CreateStockEntryLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @ApiProperty({ description: 'Quantité reçue (RM-IN02 > 0)' })
  @IsNumber()
  @Min(0.0001)
  qtyPlanned!: number;

  @ApiPropertyOptional({
    description:
      'Quantité acceptée en stock (défaut = qtyPlanned si qualité accepted)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyActual?: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Obligatoire si trackLots' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Un n° de série par unité si trackSerials',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreateStockEntryDto {
  @ApiProperty({ enum: StockEntryTypeDto })
  @IsEnum(StockEntryTypeDto)
  movementType!: StockEntryTypeDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  movementDate?: string;

  @ApiPropertyOptional({ description: 'N° BL fournisseur, etc.' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ enum: StockQualityStatusDto })
  @IsOptional()
  @IsEnum(StockQualityStatusDto)
  qualityStatus?: StockQualityStatusDto;

  @ApiPropertyOptional({
    description: 'Obligatoire pour IN_ADJUSTMENT',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Valider immédiatement après création',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  validate?: boolean;

  @ApiProperty({ type: [CreateStockEntryLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockEntryLineDto)
  lines!: CreateStockEntryLineDto[];
}
