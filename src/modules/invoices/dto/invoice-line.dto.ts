import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MecefTaxGroup } from '../enums/mecef.enum';

export class InvoiceLineDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  itemId?: string;

  @ApiProperty({ example: 'Prestation conseil' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ example: 1000, description: 'Prix unitaire HT' })
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  taxRateId!: string;

  @ApiPropertyOptional({
    enum: MecefTaxGroup,
    example: MecefTaxGroup.B,
    description: 'Groupe fiscal e-MECeF DGI (A=0%, B=18%, C=Export, D=Exonéré spécifique)',
  })
  @IsEnum(MecefTaxGroup)
  @IsOptional()
  taxGroup?: MecefTaxGroup;
}
