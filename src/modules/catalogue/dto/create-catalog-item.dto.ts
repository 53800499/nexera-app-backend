import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum CatalogItemTypeDto {
  product = 'product',
  service = 'service',
  package = 'package',
}

export class CreateCatalogItemDto {
  @ApiPropertyOptional({
    description:
      'Référence manuelle unique (RM-A01). Si omise, génération automatique ART-XXXXXX.',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: CatalogItemTypeDto,
    description: 'Type : article (product), service, forfait (package)',
  })
  @IsEnum(CatalogItemTypeDto)
  itemType!: CatalogItemTypeDto;

  @ApiPropertyOptional({ default: 'unit', description: 'Unité de mesure' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ minimum: 0, description: 'Prix HT — >= 0 (RM-A02)' })
  @IsNumber()
  @Min(0)
  priceHt!: number;

  @ApiProperty({ description: 'Taux de TVA paramétré (obligatoire — RM-A03)' })
  @IsString()
  @IsNotEmpty()
  defaultTaxRateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Remise maximale autorisée (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
