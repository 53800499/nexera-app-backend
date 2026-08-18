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
import { RhScheduleType, RhTimeRecordStatus, RhAbsenceStatus } from '@prisma/client';

export class CreatePlanningHoraireDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  etablissementId: string;

  @ApiProperty({ example: 'HOR-40H-STD' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Horaire Standard 40h (Lun-Ven 8h-12h / 14h-18h)' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ enum: RhScheduleType, default: RhScheduleType.HEBDOMADAIRE_STANDARD })
  @IsEnum(RhScheduleType)
  @IsOptional()
  typeAmenagement?: RhScheduleType;

  @ApiPropertyOptional({ example: 40, default: 40 })
  @IsNumber()
  @IsOptional()
  heuresHebdomadairesStandard?: number;

  @ApiPropertyOptional()
  @IsOptional()
  detailsGrilleJson?: any;
}

export class CreateReleveTempsDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  @IsNotEmpty()
  dateJour: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsString()
  @IsOptional()
  heureArriveeReelle?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsString()
  @IsOptional()
  heureDepartReelle?: string;

  @ApiPropertyOptional({ example: 60, default: 0 })
  @IsInt()
  @IsOptional()
  pauseMinutes?: number;

  @ApiPropertyOptional({ example: 8, default: 8 })
  @IsNumber()
  @IsOptional()
  heuresNormales?: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsNumber()
  @IsOptional()
  heuresSup15?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @IsOptional()
  heuresSup50?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @IsOptional()
  heuresSupNuit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @IsOptional()
  heuresSupDimancheFerie?: number;
}

export class BatchReleveTempsDto {
  @ApiProperty({ type: [CreateReleveTempsDto] })
  @IsNotEmpty()
  releves: CreateReleveTempsDto[];
}

export class ValidateReleveTempsDto {
  @ApiProperty({ enum: RhTimeRecordStatus, default: RhTimeRecordStatus.VALIDE_RH })
  @IsEnum(RhTimeRecordStatus)
  @IsNotEmpty()
  statutValidation: RhTimeRecordStatus;
}

export class CreateAbsenceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  typeAbsenceId: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  @IsNotEmpty()
  dateFin: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  demiJourneeDebut?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  demiJourneeFin?: boolean;

  @ApiProperty({ example: 12, description: 'Nombre de jours ouvrables décomptés' })
  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  nombreJoursOuvrables: number;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @IsOptional()
  nombreJoursCalendaires?: number;

  @ApiPropertyOptional({ example: 'Congés annuels d’été' })
  @IsString()
  @IsOptional()
  motif?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  documentJustificatifUrl?: string;
}

export class ValidateAbsenceDto {
  @ApiProperty({ enum: RhAbsenceStatus, description: 'VALIDE_MANAGER, VALIDE_RH, REJETE' })
  @IsEnum(RhAbsenceStatus)
  @IsNotEmpty()
  statut: RhAbsenceStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  commentaireRejet?: string;
}

export class AdjustSoldeCongeDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @IsNotEmpty()
  anneeReference: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  droitsAcquis?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  droitsSupplementairesAnciennete?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  droitsSupplementairesEnfants?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  joursConsommes?: number;
}
