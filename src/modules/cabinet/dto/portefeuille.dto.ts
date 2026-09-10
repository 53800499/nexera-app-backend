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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetPeriodiciteFacturation,
  CabinetStatutLettreMission,
  CabinetStatutMandat,
  CabinetTypeMandat,
} from '@prisma/client';

export class CreateCabinetEntiteDto {
  @ApiProperty({ example: 'NOVAXIS EXPERTISE & AUDIT' })
  @IsString()
  @IsNotEmpty()
  raisonSociale: string;

  @ApiPropertyOptional({ example: 'OECCA-BJ-2024-042' })
  @IsString()
  @IsOptional()
  numeroInscriptionOrdre?: string;

  @ApiPropertyOptional({ example: 'BJ' })
  @IsString()
  @IsOptional()
  paysCode?: string;

  @ApiPropertyOptional({ example: 'Cotonou, Haie Vive' })
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional({ example: '+229 01 23 45 67' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ example: 'contact@novaxis-audit.com' })
  @IsString()
  @IsOptional()
  emailContact?: string;
}

export class UpdateCabinetEntiteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  raisonSociale?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroInscriptionOrdre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paysCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emailContact?: string;
}

export class CreateCabinetMandatDto {
  @ApiProperty({ description: 'ID tenant de l’entreprise cliente' })
  @IsUUID()
  @IsNotEmpty()
  clientTenantId: string;

  @ApiProperty({ enum: CabinetTypeMandat, example: CabinetTypeMandat.TENUE_COMPTABLE })
  @IsEnum(CabinetTypeMandat)
  @IsNotEmpty()
  typeMandat: CabinetTypeMandat;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @ApiPropertyOptional({ enum: CabinetStatutMandat, default: CabinetStatutMandat.ACTIF })
  @IsEnum(CabinetStatutMandat)
  @IsOptional()
  statut?: CabinetStatutMandat;

  @ApiPropertyOptional({ description: 'Collaborateur responsable du dossier' })
  @IsUUID()
  @IsOptional()
  collaborateurResponsableId?: string;
}

export class UpdateCabinetMandatDto {
  @ApiPropertyOptional({ enum: CabinetTypeMandat })
  @IsEnum(CabinetTypeMandat)
  @IsOptional()
  typeMandat?: CabinetTypeMandat;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @ApiPropertyOptional({ enum: CabinetStatutMandat })
  @IsEnum(CabinetStatutMandat)
  @IsOptional()
  statut?: CabinetStatutMandat;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  collaborateurResponsableId?: string;
}

export class CreateCabinetLettreMissionDto {
  @ApiProperty({ description: 'ID du mandat associé' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'Tenue comptable complète SYSCOHADA et déclarations fiscales mensuelles' })
  @IsString()
  @IsNotEmpty()
  perimetreTexte: string;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  honorairesConvenus?: number;

  @ApiPropertyOptional({ example: 'XOF', default: 'XOF' })
  @IsString()
  @IsOptional()
  deviseCode?: string;

  @ApiPropertyOptional({ enum: CabinetPeriodiciteFacturation, default: CabinetPeriodiciteFacturation.MENSUELLE })
  @IsEnum(CabinetPeriodiciteFacturation)
  @IsOptional()
  periodiciteFacturation?: CabinetPeriodiciteFacturation;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateSignature?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  documentUrl?: string;

  @ApiPropertyOptional({ enum: CabinetStatutLettreMission, default: CabinetStatutLettreMission.BROUILLON })
  @IsEnum(CabinetStatutLettreMission)
  @IsOptional()
  statut?: CabinetStatutLettreMission;
}

export class UpdateCabinetLettreMissionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  perimetreTexte?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  honorairesConvenus?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deviseCode?: string;

  @ApiPropertyOptional({ enum: CabinetPeriodiciteFacturation })
  @IsEnum(CabinetPeriodiciteFacturation)
  @IsOptional()
  periodiciteFacturation?: CabinetPeriodiciteFacturation;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateSignature?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  documentUrl?: string;

  @ApiPropertyOptional({ enum: CabinetStatutLettreMission })
  @IsEnum(CabinetStatutLettreMission)
  @IsOptional()
  statut?: CabinetStatutLettreMission;
}

export class CreateCabinetClientContactDto {
  @ApiProperty({ description: 'ID du mandat associé' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'KOUASSI Marc' })
  @IsString()
  @IsNotEmpty()
  nomPrenoms: string;

  @ApiPropertyOptional({ example: 'Directeur Général' })
  @IsString()
  @IsOptional()
  fonction?: string;

  @ApiPropertyOptional({ example: 'dg@client.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+229 97 00 11 22' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  contactPrincipal?: boolean;
}

export class UpdateCabinetClientContactDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomPrenoms?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fonction?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  contactPrincipal?: boolean;
}
