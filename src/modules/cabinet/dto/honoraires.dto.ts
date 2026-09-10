import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CabinetStatutNoteHonoraires } from '@prisma/client';

export class CreateCabinetTempsPasseDto {
  @ApiProperty({ description: 'ID de la mission' })
  @IsUUID()
  @IsNotEmpty()
  cabinetMissionId: string;

  @ApiProperty({ example: '2026-02-05' })
  @IsDateString()
  @IsNotEmpty()
  datePrestation: string;

  @ApiProperty({ example: 3.5 })
  @IsNumber()
  @Min(0.1)
  @IsNotEmpty()
  dureeHeures: number;

  @ApiPropertyOptional({ example: 'Revue des comptes tiers et cadrage TVA' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  facturable?: boolean;
}

export class UpdateCabinetTempsPasseDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  datePrestation?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0.1)
  @IsOptional()
  dureeHeures?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  facturable?: boolean;
}

export class CreateCabinetNoteHonorairesLigneDto {
  @ApiProperty({ example: 'Honoraires de tenue comptable - Janvier 2026' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantite?: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  prixUnitaire?: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montant: number;
}

export class CreateCabinetNoteHonorairesDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'HON-2026-0001' })
  @IsString()
  @IsNotEmpty()
  numero: string;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  @IsNotEmpty()
  dateEmission: string;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montantTotalHt: number;

  @ApiPropertyOptional({ example: 45000, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  montantTva?: number;

  @ApiProperty({ example: 295000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montantTotalTtc: number;

  @ApiPropertyOptional({ example: 'XOF', default: 'XOF' })
  @IsString()
  @IsOptional()
  deviseCode?: string;

  @ApiPropertyOptional({ enum: CabinetStatutNoteHonoraires, default: CabinetStatutNoteHonoraires.BROUILLON })
  @IsEnum(CabinetStatutNoteHonoraires)
  @IsOptional()
  statut?: CabinetStatutNoteHonoraires;

  @ApiProperty({ type: [CreateCabinetNoteHonorairesLigneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCabinetNoteHonorairesLigneDto)
  lignes: CreateCabinetNoteHonorairesLigneDto[];
}

export class UpdateCabinetNoteHonorairesDto {
  @ApiPropertyOptional({ enum: CabinetStatutNoteHonoraires })
  @IsEnum(CabinetStatutNoteHonoraires)
  @IsOptional()
  statut?: CabinetStatutNoteHonoraires;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateEmission?: string;
}
