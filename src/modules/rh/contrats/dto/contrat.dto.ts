import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  RhContractType,
  RhContractStatus,
  RhProbationStatus,
  RhAmendmentType,
  RhTerminationType,
} from '@prisma/client';

export class CreateContratDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  etablissementId: string;

  @ApiPropertyOptional({ example: 'CTR-000001', description: 'Généré automatiquement si vide' })
  @IsString()
  @IsOptional()
  numeroContrat?: string;

  @ApiProperty({ enum: RhContractType, default: RhContractType.CDI })
  @IsEnum(RhContractType)
  @IsNotEmpty()
  typeContrat: RhContractType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  dateSignature?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Requis pour CDD, Stage, etc.' })
  @IsDateString()
  @IsOptional()
  dateFinPrevue?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  clauseExclusivite?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  clauseNonConcurrence?: boolean;

  @ApiProperty({ example: 250000, description: 'Salaire brut de base mensuel en FCFA' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  salaireBaseMensuel: number;

  @ApiPropertyOptional({ example: 'XOF', default: 'XOF' })
  @IsString()
  @IsOptional()
  deviseCode?: string;

  @ApiPropertyOptional({ example: 40, default: 40 })
  @IsNumber()
  @IsOptional()
  dureeHebdoContrat?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posteId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categorieProfessionnelleId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  conventionCollectiveId?: string;

  // Période d'essai optionnelle à la création
  @ApiPropertyOptional({ example: 1, description: 'Durée de la période d’essai en mois (0 si pas d’essai)' })
  @IsInt()
  @IsOptional()
  periodeEssaiMois?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fichierContratUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateContratDto {
  @ApiPropertyOptional({ enum: RhContractStatus })
  @IsEnum(RhContractStatus)
  @IsOptional()
  statut?: RhContractStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFinPrevue?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaireBaseMensuel?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  dureeHebdoContrat?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posteId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categorieProfessionnelleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fichierContratUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RenouvelerEssaiDto {
  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  @IsNotEmpty()
  dateDebutRenouvellement: string;

  @ApiProperty({ example: '2026-02-28' })
  @IsDateString()
  @IsNotEmpty()
  dateFinRenouvellement: string;

  @ApiPropertyOptional({ example: 'Renouvellement écrit unique (Art. 19-24 CT Bénin)' })
  @IsString()
  @IsOptional()
  motif?: string;
}

export class IssueEssaiDto {
  @ApiProperty({ enum: RhProbationStatus })
  @IsEnum(RhProbationStatus)
  @IsNotEmpty()
  statutIssue: RhProbationStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateNotificationRupture?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motifRupture?: string;
}

export class CreateAvenantDto {
  @ApiPropertyOptional({ example: 'AVN-001' })
  @IsString()
  @IsOptional()
  numeroAvenant?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsDateString()
  @IsOptional()
  dateNotification?: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  @IsNotEmpty()
  dateEffet: string;

  @ApiProperty({ enum: RhAmendmentType, default: RhAmendmentType.SALAIRE })
  @IsEnum(RhAmendmentType)
  @IsNotEmpty()
  typeModification: RhAmendmentType;

  @ApiPropertyOptional({ example: 300000 })
  @IsNumber()
  @IsOptional()
  salaireBaseApres?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  tempsTravailApres?: number;

  @ApiPropertyOptional()
  @IsOptional()
  detailsModificationsJson?: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fichierAvenantUrl?: string;
}

export class CreateRuptureDto {
  @ApiProperty({ enum: RhTerminationType })
  @IsEnum(RhTerminationType)
  @IsNotEmpty()
  typeRupture: RhTerminationType;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  @IsNotEmpty()
  dateNotification: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  @IsNotEmpty()
  dateEffet: string;

  @ApiPropertyOptional({ example: 30, default: 0 })
  @IsInt()
  @IsOptional()
  dureePreavisJours?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  dispensePreavis?: boolean;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @IsOptional()
  montantIndemnitePreavis?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsNumber()
  @IsOptional()
  montantIndemniteLicenciement?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsNumber()
  @IsOptional()
  montantIndemniteCongesPayes?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  montantDommagesInterets?: number;

  @ApiPropertyOptional({ example: 'Départ négocié / Rupture conventionnelle' })
  @IsString()
  @IsOptional()
  motifDetaille?: string;
}
