import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum StockValuationMethodDto {
  cmup = 'cmup',
  fifo = 'fifo',
  lifo = 'lifo',
}

export class CreateStockItemDto {
  @ApiProperty({ description: 'ID article catalogue (commercial.catalog_items)' })
  @IsString()
  @IsNotEmpty()
  commercialItemId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackLots?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackSerials?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({
    enum: StockValuationMethodDto,
    default: StockValuationMethodDto.cmup,
  })
  @IsOptional()
  @IsEnum(StockValuationMethodDto)
  valuationMethod?: StockValuationMethodDto;

  @ApiProperty({ description: 'Unité de stockage' })
  @IsString()
  @IsNotEmpty()
  storageUnit!: string;

  @ApiPropertyOptional({
    default: 1,
    description: 'Facteur de conversion unité vente → unité stock',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  conversionFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  safetyStockQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLocationId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;
}
