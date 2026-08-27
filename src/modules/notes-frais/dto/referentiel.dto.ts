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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategorieDepenseDto {
  @ApiPropertyOptional({ description: 'Code pays ISO2 (ex: BJ, null = multi-pays)' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiProperty({ description: 'Code unique de la catégorie (ex: TRANSPORT, HEBERGEMENT)' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: 'Libellé de la catégorie' })
  @IsNotEmpty()
  @IsString()
  libelle: string;

  @ApiPropertyOptional({ description: 'Compte comptable SYSCOHADA par défaut (ex: 6251)' })
  @IsOptional()
  @IsString()
  compteSyscohadaDefaut?: string;

  @ApiPropertyOptional({ description: 'TVA déductible / récupérable par défaut' })
  @IsOptional()
  @IsBoolean()
  tvaRecuperableParDefaut?: boolean;

  @ApiPropertyOptional({ description: 'Taux de TVA par défaut (ex: 18)' })
  @IsOptional()
  @IsNumber()
  tauxTvaParDefaut?: number;

  @ApiPropertyOptional({ description: 'Justificatif obligatoire' })
  @IsOptional()
  @IsBoolean()
  justificatifObligatoire?: boolean;
}

export class UpdateCategorieDepenseDto {
  @ApiPropertyOptional({ description: 'Libellé de la catégorie' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ description: 'Compte comptable SYSCOHADA par défaut (ex: 6251)' })
  @IsOptional()
  @IsString()
  compteSyscohadaDefaut?: string;

  @ApiPropertyOptional({ description: 'TVA déductible / récupérable par défaut' })
  @IsOptional()
  @IsBoolean()
  tvaRecuperableParDefaut?: boolean;

  @ApiPropertyOptional({ description: 'Taux de TVA par défaut (ex: 18)' })
  @IsOptional()
  @IsNumber()
  tauxTvaParDefaut?: number;

  @ApiPropertyOptional({ description: 'Justificatif obligatoire' })
  @IsOptional()
  @IsBoolean()
  justificatifObligatoire?: boolean;

  @ApiPropertyOptional({ description: 'Catégorie active' })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CreatePolitiqueDepenseDto {
  @ApiProperty({ description: 'ID de la catégorie de dépense' })
  @IsNotEmpty()
  @IsUUID()
  categorieDepenseId: string;

  @ApiPropertyOptional({ description: 'Code pays ISO2' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ description: 'Niveau hiérarchique (EMPLOYE, CADRE, DIRECTION)' })
  @IsOptional()
  @IsString()
  niveauHierarchique?: string;

  @ApiPropertyOptional({ description: 'Plafond maximal autorisé' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plafondMontant?: number;

  @ApiPropertyOptional({ description: 'Devise du plafond (ex: XOF)' })
  @IsOptional()
  @IsString()
  plafondDevise?: string;

  @ApiPropertyOptional({ description: 'Règles complémentaires en JSON' })
  @IsOptional()
  regleComplementaire?: any;

  @ApiProperty({ description: 'Date de début de validité (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional({ description: 'Date de fin de validité (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class CalculerIndemniteKmDto {
  @ApiProperty({ description: 'Distance parcourue en kilomètres' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  distanceKm: number;

  @ApiProperty({ description: 'Puissance fiscale du véhicule (en CV)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  puissanceFiscale: number;

  @ApiPropertyOptional({ description: 'Type de véhicule (VOITURE, MOTO)' })
  @IsOptional()
  @IsString()
  typeVehicule?: 'VOITURE' | 'MOTO';

  @ApiPropertyOptional({ description: 'Code pays ISO2 (défaut: BJ)' })
  @IsOptional()
  @IsString()
  paysCode?: string;
}

export class CalculerPerDiemDto {
  @ApiProperty({ description: 'Nombre de jours de mission' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  nombreJours: number;

  @ApiProperty({ description: 'Zone géographique de destination' })
  @IsNotEmpty()
  @IsString()
  zoneGeographique: string;

  @ApiPropertyOptional({ description: 'Code pays ISO2 (défaut: BJ)' })
  @IsOptional()
  @IsString()
  paysCode?: string;
}
