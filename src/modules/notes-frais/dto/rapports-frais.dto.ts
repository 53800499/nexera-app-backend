import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRapportFraisDto {
  @ApiProperty({ description: 'ID du salarié déclarant (M4 RhEmploye)' })
  @IsNotEmpty()
  @IsUUID()
  employeRefId: string;

  @ApiPropertyOptional({ description: 'ID de la mission rattachée' })
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiProperty({ description: 'Objet / Intitulé du rapport de frais' })
  @IsNotEmpty()
  @IsString()
  objet: string;

  @ApiProperty({ description: 'Date de début de période (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  periodeDebut: string;

  @ApiProperty({ description: 'Date de fin de période (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  periodeFin: string;

  @ApiPropertyOptional({ description: 'ID de l’avance de frais à imputer' })
  @IsOptional()
  @IsUUID()
  avanceFraisId?: string;
}

export class UpdateRapportFraisDto {
  @ApiPropertyOptional({ description: 'Objet / Intitulé du rapport de frais' })
  @IsOptional()
  @IsString()
  objet?: string;

  @ApiPropertyOptional({ description: 'Date de début de période (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  periodeDebut?: string;

  @ApiPropertyOptional({ description: 'Date de fin de période (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  periodeFin?: string;

  @ApiPropertyOptional({ description: 'ID de la mission rattachée' })
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiPropertyOptional({ description: 'ID de l’avance de frais à imputer' })
  @IsOptional()
  @IsUUID()
  avanceFraisId?: string;
}

export class ValiderRapportDto {
  @ApiPropertyOptional({ description: 'Commentaire ou observation du valideur' })
  @IsOptional()
  @IsString()
  commentaire?: string;
}

export class RejeterRapportDto {
  @ApiProperty({ description: 'Motif obligatoire du rejet' })
  @IsNotEmpty()
  @IsString()
  motifRejet: string;
}
