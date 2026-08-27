import {
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

export class CreateDepenseKilometriqueDto {
  @ApiProperty({ description: 'Lieu de départ' })
  @IsNotEmpty()
  @IsString()
  trajetDepart: string;

  @ApiProperty({ description: "Lieu d'arrivée" })
  @IsNotEmpty()
  @IsString()
  trajetArrivee: string;

  @ApiProperty({ description: 'Distance en km' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  distanceKm: number;

  @ApiProperty({ description: 'Puissance fiscale du véhicule (en CV)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  puissanceFiscaleVehicule: number;

  @ApiProperty({ description: 'ID du barème kilométrique appliqué' })
  @IsNotEmpty()
  @IsUUID()
  baremeKilometriqueId: string;
}

export class CreateDepensePerDiemDto {
  @ApiProperty({ description: 'Nombre de jours' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  nombreJours: number;

  @ApiProperty({ description: 'ID du barème per diem appliqué' })
  @IsNotEmpty()
  @IsUUID()
  baremePerDiemId: string;
}

export class CreateDepenseDto {
  @ApiProperty({ description: 'ID du rapport de frais rattaché' })
  @IsNotEmpty()
  @IsUUID()
  ndfRapportFraisId: string;

  @ApiProperty({ description: 'ID de la catégorie de dépense' })
  @IsNotEmpty()
  @IsUUID()
  categorieDepenseId: string;

  @ApiProperty({ description: 'Date de la dépense (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  dateDepense: string;

  @ApiPropertyOptional({ description: 'Nom ou raison sociale du fournisseur/commerçant' })
  @IsOptional()
  @IsString()
  fournisseurLibelle?: string;

  @ApiProperty({ description: 'Montant TTC de la dépense' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  montantTtc: number;

  @ApiPropertyOptional({ description: 'Montant de TVA (si applicable)' })
  @IsOptional()
  @IsNumber()
  montantTva?: number;

  @ApiPropertyOptional({ description: 'Taux de TVA appliqué (ex: 18)' })
  @IsOptional()
  @IsNumber()
  tauxTvaApplique?: number;

  @ApiPropertyOptional({ description: 'Devise d’origine (ex: XOF, EUR, USD)' })
  @IsOptional()
  @IsString()
  deviseCode?: string;

  @ApiPropertyOptional({ description: 'Mode de paiement' })
  @IsOptional()
  @IsString()
  modePaiement?: 'CARTE_PERSONNELLE' | 'ESPECES' | 'CARTE_AFFAIRE' | 'VIREMENT_DIRECT_FOURNISSEUR';

  @ApiPropertyOptional({ description: 'Détail de frais kilométriques (si catégorie transport)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDepenseKilometriqueDto)
  depenseKilometrique?: CreateDepenseKilometriqueDto;

  @ApiPropertyOptional({ description: 'Détail de per diem (si indemnité journalière)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDepensePerDiemDto)
  depensePerDiem?: CreateDepensePerDiemDto;

  @ApiPropertyOptional({ description: 'URL ou chemin du justificatif' })
  @IsOptional()
  @IsString()
  justificatifUrl?: string;

  @ApiPropertyOptional({ description: 'Type de fichier (IMAGE, PDF)' })
  @IsOptional()
  @IsString()
  typeFichier?: 'IMAGE' | 'PDF';
}

export class UpdateDepenseDto {
  @ApiPropertyOptional({ description: 'ID de la catégorie de dépense' })
  @IsOptional()
  @IsUUID()
  categorieDepenseId?: string;

  @ApiPropertyOptional({ description: 'Date de la dépense (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateDepense?: string;

  @ApiPropertyOptional({ description: 'Nom ou raison sociale du fournisseur/commerçant' })
  @IsOptional()
  @IsString()
  fournisseurLibelle?: string;

  @ApiPropertyOptional({ description: 'Montant TTC de la dépense' })
  @IsOptional()
  @IsNumber()
  montantTtc?: number;

  @ApiPropertyOptional({ description: 'Montant de TVA' })
  @IsOptional()
  @IsNumber()
  montantTva?: number;

  @ApiPropertyOptional({ description: 'Taux de TVA appliqué' })
  @IsOptional()
  @IsNumber()
  tauxTvaApplique?: number;

  @ApiPropertyOptional({ description: 'Mode de paiement' })
  @IsOptional()
  @IsString()
  modePaiement?: 'CARTE_PERSONNELLE' | 'ESPECES' | 'CARTE_AFFAIRE' | 'VIREMENT_DIRECT_FOURNISSEUR';
}
