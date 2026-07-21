import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** UC-S02 — le code est généré automatiquement (RM-E01). */
export class CreateWarehouseLocationDto {
  @ApiProperty({
    maxLength: 50,
    example: 'A',
    description: 'Zone (ex: A, FROID)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  zone!: string;

  @ApiProperty({ maxLength: 20, example: '01', description: 'Allée' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  aisle!: string;

  @ApiProperty({ maxLength: 20, example: '02', description: 'Rayon / étagère' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  rack!: string;

  @ApiProperty({ maxLength: 20, example: 'C3', description: 'Case' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bin!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
