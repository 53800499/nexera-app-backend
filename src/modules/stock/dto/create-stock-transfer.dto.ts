import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockTransferLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @ApiProperty({ description: 'Quantité à transférer (> 0)' })
  @IsNumber()
  @Min(0.0001)
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destLocationId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreateStockTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceWarehouseId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destWarehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateStockTransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferLineDto)
  lines!: CreateStockTransferLineDto[];
}

export class ReceiveTransferLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({ description: 'Quantité reçue (≥ 0)' })
  @IsNumber()
  @Min(0)
  qtyReceived!: number;

  @ApiPropertyOptional({
    description: 'Motif d’écart si qtyReceived ≠ qtyShipped',
  })
  @IsOptional()
  @IsString()
  varianceReason?: string;

  @ApiPropertyOptional({
    description: 'Emplacement destination (surcharge éventuelle)',
  })
  @IsOptional()
  @IsString()
  destLocationId?: string;
}

export class ReceiveStockTransferDto {
  @ApiProperty({ type: [ReceiveTransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLineDto)
  lines!: ReceiveTransferLineDto[];

  @ApiPropertyOptional({
    description: 'Motif global d’écart (si au moins une ligne diverge)',
  })
  @IsOptional()
  @IsString()
  varianceReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
