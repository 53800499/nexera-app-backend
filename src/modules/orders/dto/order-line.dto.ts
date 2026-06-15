import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class OrderLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  itemId?: string;

  @ApiProperty({ example: 'Prestation de conseil' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ example: 500, description: 'Prix unitaire HT' })
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  taxRateId!: string;
}
