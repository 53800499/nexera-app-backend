import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScanJustificatifDto {
  @ApiProperty({ description: 'URL ou fichier image/PDF du reçu à analyser' })
  @IsNotEmpty()
  @IsString()
  fichierUrl: string;

  @ApiPropertyOptional({ description: 'Type de fichier (IMAGE, PDF)' })
  @IsOptional()
  @IsString()
  typeFichier?: 'IMAGE' | 'PDF';
}

export class TraiterAnomalieDto {
  @ApiProperty({ description: 'Action (CONFIRMEE, ECARTEE_FAUX_POSITIF)' })
  @IsNotEmpty()
  @IsString()
  statut: 'CONFIRMEE' | 'ECARTEE_FAUX_POSITIF';

  @ApiPropertyOptional({ description: 'Motif ou explication' })
  @IsOptional()
  @IsString()
  motif?: string;
}
