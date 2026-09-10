import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetNiveauHabilitation,
  CabinetStatutCollaborateur,
} from '@prisma/client';

export class CreateCabinetRoleDto {
  @ApiProperty({ example: 'COLLABORATEUR_SENIOR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Collaborateur Senior / Chef de mission' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ enum: CabinetNiveauHabilitation, default: CabinetNiveauHabilitation.VALIDATION })
  @IsEnum(CabinetNiveauHabilitation)
  @IsOptional()
  niveauHabilitationDefaut?: CabinetNiveauHabilitation;
}

export class CreateCabinetCollaborateurDto {
  @ApiProperty({ example: 'ADJOVI Paul' })
  @IsString()
  @IsNotEmpty()
  nomPrenoms: string;

  @ApiProperty({ description: 'ID du rôle cabinet' })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({ example: 'paul.adjovi@novaxis-audit.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+229 97 12 34 56' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ example: 'OECCA-STAG-102' })
  @IsString()
  @IsOptional()
  numeroOrdreProfessionnel?: string;

  @ApiPropertyOptional({ description: 'Liaison optionnelle avec un utilisateur système' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ enum: CabinetStatutCollaborateur, default: CabinetStatutCollaborateur.ACTIF })
  @IsEnum(CabinetStatutCollaborateur)
  @IsOptional()
  statut?: CabinetStatutCollaborateur;
}

export class UpdateCabinetCollaborateurDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomPrenoms?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroOrdreProfessionnel?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ enum: CabinetStatutCollaborateur })
  @IsEnum(CabinetStatutCollaborateur)
  @IsOptional()
  statut?: CabinetStatutCollaborateur;
}

export class CreateCabinetHabilitationDto {
  @ApiProperty({ description: 'ID du collaborateur' })
  @IsUUID()
  @IsNotEmpty()
  collaborateurId: string;

  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ enum: CabinetNiveauHabilitation, example: CabinetNiveauHabilitation.ANNOTATION })
  @IsEnum(CabinetNiveauHabilitation)
  @IsNotEmpty()
  niveauAcces: CabinetNiveauHabilitation;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  dateFin?: string;
}

export class UpdateCabinetHabilitationDto {
  @ApiPropertyOptional({ enum: CabinetNiveauHabilitation })
  @IsEnum(CabinetNiveauHabilitation)
  @IsOptional()
  niveauAcces?: CabinetNiveauHabilitation;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFin?: string;
}
