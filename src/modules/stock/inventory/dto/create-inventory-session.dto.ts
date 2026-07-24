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

export enum InventoryTypeDto {
  total = 'total',
  partial = 'partial',
}

export class CreateInventorySessionDto {
  @ApiProperty({ enum: InventoryTypeDto })
  @IsEnum(InventoryTypeDto)
  type!: InventoryTypeDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({
    description: 'Obligatoire pour inventaire partiel (catégorie catalogue)',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  freezeMovements?: boolean;

  @ApiPropertyOptional({
    description: 'Seuil d’écart qté pour double comptage (RM-INV03)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  varianceThresholdQty?: number;

  @ApiPropertyOptional({
    description: 'Seuil valeur pour filtrer les écarts significatifs',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  significantVarianceValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryCountLineInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({ description: 'Quantité comptée (≥ 0)' })
  @IsNumber()
  @Min(0)
  qtyCounted!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitInventoryCountsDto {
  @ApiProperty({ type: [InventoryCountLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryCountLineInputDto)
  lines!: InventoryCountLineInputDto[];
}
