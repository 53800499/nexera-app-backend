import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateReplenishmentDto {
  @ApiPropertyOptional({ description: 'Depuis une alerte rupture' })
  @IsOptional()
  @IsString()
  alertId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Quantité forcée (sinon reorderQty / suggestion IA)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  qtyProposed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectReplenishmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
