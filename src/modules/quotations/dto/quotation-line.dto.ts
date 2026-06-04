import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class QuotationLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  itemId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPct?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsUUID()
  @IsNotEmpty()
  taxRateId!: string;
}
