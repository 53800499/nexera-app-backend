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

export enum StockExitTypeDto {
  OUT_SALE = 'OUT_SALE',
  OUT_CONSUMPTION = 'OUT_CONSUMPTION',
  OUT_LOSS = 'OUT_LOSS',
  OUT_RETURN_SUPPLIER = 'OUT_RETURN_SUPPLIER',
  OUT_ADJUSTMENT = 'OUT_ADJUSTMENT',
}

export class CreateStockExitLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @ApiProperty({ description: 'Quantité à sortir (> 0)' })
  @IsNumber()
  @Min(0.0001)
  qty!: number;

  @ApiPropertyOptional({
    description: 'Lot forcé (sinon FIFO auto si applicable — RM-OUT02)',
  })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'N° de série sortis (RM-OUT05)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreateStockExitDto {
  @ApiProperty({ enum: StockExitTypeDto })
  @IsEnum(StockExitTypeDto)
  movementType!: StockExitTypeDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  movementDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Centre de coût (obligatoire pour OUT_CONSUMPTION)',
  })
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiPropertyOptional({
    description: 'Motif (obligatoire pour OUT_LOSS / OUT_ADJUSTMENT)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Valider immédiatement si autorisé',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  validate?: boolean;

  @ApiProperty({ type: [CreateStockExitLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockExitLineDto)
  lines!: CreateStockExitLineDto[];
}
