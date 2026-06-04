import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CheckClientDuplicateDto {
  @ApiPropertyOptional({ description: 'SIRET / RCCM' })
  @IsOptional()
  @IsString()
  siret?: string;

  @ApiPropertyOptional({ description: 'IFU / identifiant fiscal (taxId)' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;
}
