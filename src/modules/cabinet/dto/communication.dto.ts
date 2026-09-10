import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetAuteurMessage,
  CabinetDeposeParType,
  CabinetStatutDemandePiece,
} from '@prisma/client';

export class CreateCabinetDemandePieceDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiPropertyOptional({ description: 'ID de la mission associée' })
  @IsUUID()
  @IsOptional()
  cabinetMissionId?: string;

  @ApiProperty({ example: 'Grand livre des comptes clients et relevés bancaires Q4' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ example: '2026-02-28' })
  @IsDateString()
  @IsOptional()
  dateLimiteReponse?: string;

  @ApiPropertyOptional({ enum: CabinetStatutDemandePiece, default: CabinetStatutDemandePiece.EN_ATTENTE })
  @IsEnum(CabinetStatutDemandePiece)
  @IsOptional()
  statut?: CabinetStatutDemandePiece;
}

export class UpdateCabinetDemandePieceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateLimiteReponse?: string;

  @ApiPropertyOptional({ enum: CabinetStatutDemandePiece })
  @IsEnum(CabinetStatutDemandePiece)
  @IsOptional()
  statut?: CabinetStatutDemandePiece;
}

export class CreateCabinetMessageDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiPropertyOptional({ enum: CabinetAuteurMessage, default: CabinetAuteurMessage.COLLABORATEUR_CABINET })
  @IsEnum(CabinetAuteurMessage)
  @IsOptional()
  auteurType?: CabinetAuteurMessage;

  @ApiProperty({ example: 'Bonjour, pourriez-vous nous transmettre les factures d’achat manquantes du mois ?' })
  @IsString()
  @IsNotEmpty()
  contenu: string;
}

export class CreateCabinetDocumentPartageDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiPropertyOptional({ enum: CabinetDeposeParType, default: CabinetDeposeParType.COLLABORATEUR_CABINET })
  @IsEnum(CabinetDeposeParType)
  @IsOptional()
  deposeParType?: CabinetDeposeParType;

  @ApiProperty({ example: 'https://storage.nexera.app/docs/balance-generale-2026.pdf' })
  @IsString()
  @IsNotEmpty()
  fichierUrl: string;

  @ApiProperty({ example: 'Balance générale provisoire - Décembre 2025' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ example: 1048576 })
  @IsNumber()
  @IsOptional()
  tailleOctets?: number;
}
