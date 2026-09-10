import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetStatutEcheance,
  CabinetStatutMission,
  CabinetStatutTache,
  CabinetTypeMission,
} from '@prisma/client';

export class CreateCabinetMissionDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'Tenue comptable - Janvier 2026' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ enum: CabinetTypeMission, default: CabinetTypeMission.RECURRENTE })
  @IsEnum(CabinetTypeMission)
  @IsOptional()
  typeMission?: CabinetTypeMission;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsString()
  @IsOptional()
  periodeReference?: string;

  @ApiPropertyOptional({ example: '2026-02-15' })
  @IsDateString()
  @IsOptional()
  dateEcheance?: string;

  @ApiPropertyOptional({ enum: CabinetStatutMission, default: CabinetStatutMission.PLANIFIEE })
  @IsEnum(CabinetStatutMission)
  @IsOptional()
  statut?: CabinetStatutMission;
}

export class UpdateCabinetMissionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional({ enum: CabinetTypeMission })
  @IsEnum(CabinetTypeMission)
  @IsOptional()
  typeMission?: CabinetTypeMission;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  periodeReference?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateEcheance?: string;

  @ApiPropertyOptional({ enum: CabinetStatutMission })
  @IsEnum(CabinetStatutMission)
  @IsOptional()
  statut?: CabinetStatutMission;
}

export class CreateCabinetTacheDto {
  @ApiProperty({ description: 'ID de la mission parente' })
  @IsUUID()
  @IsNotEmpty()
  cabinetMissionId: string;

  @ApiProperty({ example: 'Rapprochement bancaire et lettrage' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ description: 'ID du collaborateur assigné' })
  @IsUUID()
  @IsOptional()
  collaborateurAssigneId?: string;

  @ApiPropertyOptional({ example: '2026-02-10' })
  @IsDateString()
  @IsOptional()
  dateEcheance?: string;

  @ApiPropertyOptional({ enum: CabinetStatutTache, default: CabinetStatutTache.A_FAIRE })
  @IsEnum(CabinetStatutTache)
  @IsOptional()
  statut?: CabinetStatutTache;
}

export class UpdateCabinetTacheDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  collaborateurAssigneId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateEcheance?: string;

  @ApiPropertyOptional({ enum: CabinetStatutTache })
  @IsEnum(CabinetStatutTache)
  @IsOptional()
  statut?: CabinetStatutTache;
}

export class CreateCabinetEcheanceDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'Déclaration TVA Mensuelle - Janvier 2026' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiProperty({ example: '2026-02-15' })
  @IsDateString()
  @IsNotEmpty()
  dateLimite: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  referenceEcheanceM7?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  cabinetMissionId?: string;

  @ApiPropertyOptional({ enum: CabinetStatutEcheance, default: CabinetStatutEcheance.A_VENIR })
  @IsEnum(CabinetStatutEcheance)
  @IsOptional()
  statut?: CabinetStatutEcheance;
}

export class UpdateCabinetEcheanceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateLimite?: string;

  @ApiPropertyOptional({ enum: CabinetStatutEcheance })
  @IsEnum(CabinetStatutEcheance)
  @IsOptional()
  statut?: CabinetStatutEcheance;
}
