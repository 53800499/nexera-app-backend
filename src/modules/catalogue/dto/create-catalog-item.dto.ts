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
  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CatalogItemTypeDto)
  itemType: CatalogItemTypeDto;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  priceHt: number;

  @IsString()
  @IsNotEmpty()
  defaultTaxRateId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  maxDiscountPct?: number;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
