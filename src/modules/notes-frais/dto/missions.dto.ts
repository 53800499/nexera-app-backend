import {
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

export class CreateMissionDto {
  @ApiProperty({ description: "ID du salarié bénéficiaire (M4 RhEmploye)" })
  @IsNotEmpty()
  @IsUUID()
  employeRefId: string;

  @ApiProperty({ description: "Objet ou motif du déplacement professionnel" })
  @IsNotEmpty()
  @IsString()
  objet: string;

  @ApiPropertyOptional({ description: "Lieu / Ville / Pays de destination" })
  @IsOptional()
  @IsString()
  lieuDestination?: string;

  @ApiProperty({ description: "Date de début de mission (YYYY-MM-DD)" })
  @IsNotEmpty()
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ description: "Date de fin de mission (YYYY-MM-DD)" })
  @IsNotEmpty()
  @IsDateString()
  dateFin: string;
}

export class UpdateMissionDto {
  @ApiPropertyOptional({ description: "Objet ou motif du déplacement professionnel" })
  @IsOptional()
  @IsString()
  objet?: string;

  @ApiPropertyOptional({ description: "Lieu / Ville / Pays de destination" })
  @IsOptional()
  @IsString()
  lieuDestination?: string;

  @ApiPropertyOptional({ description: "Date de début de mission (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({ description: "Date de fin de mission (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({ description: "Statut de la mission" })
  @IsOptional()
  @IsString()
  statut?: 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
}

export class CreateAvanceFraisDto {
  @ApiProperty({ description: "ID du salarié bénéficiaire" })
  @IsNotEmpty()
  @IsUUID()
  employeRefId: string;

  @ApiPropertyOptional({ description: "ID de la mission rattachée" })
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiProperty({ description: "Montant versé de l'avance" })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  montant: number;

  @ApiPropertyOptional({ description: "Devise (ex: XOF)" })
  @IsOptional()
  @IsString()
  deviseCode?: string;

  @ApiProperty({ description: "Date du versement de l'avance" })
  @IsNotEmpty()
  @IsDateString()
  dateVersement: string;
}

export class RegulariserAvanceDto {
  @ApiProperty({ description: "Montant à régulariser" })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  montant: number;
}
