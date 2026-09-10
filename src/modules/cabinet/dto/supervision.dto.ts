import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetModuleSource,
  CabinetNiveauSeverite,
  CabinetStatutChecklistItem,
  CabinetStatutPointRevue,
} from '@prisma/client';

export class CreateCabinetPointRevueDto {
  @ApiProperty({ description: 'ID du mandat client' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ enum: CabinetModuleSource, example: CabinetModuleSource.M4_RH_PAIE })
  @IsEnum(CabinetModuleSource)
  @IsNotEmpty()
  moduleSource: CabinetModuleSource;

  @ApiProperty({ example: 'rh_bulletin_paie' })
  @IsString()
  @IsNotEmpty()
  objetType: string;

  @ApiProperty({ example: 'b5f0535e-9a29-450f-9080-1a0678d4baec', description: "Identifiant ou référence de l'objet métier" })
  @IsString({ message: "L'identifiant de l'objet doit être une chaîne de caractères." })
  @IsNotEmpty({ message: "L'identifiant de l'objet est obligatoire." })
  @MaxLength(100, { message: "L'identifiant de l'objet ne peut pas dépasser 100 caractères." })
  objetId: string;

  @ApiProperty({ example: 'Heures supplémentaires sans majoration légale constatées sur ce bulletin.' })
  @IsString()
  @IsNotEmpty()
  texte: string;

  @ApiPropertyOptional({ enum: CabinetNiveauSeverite, default: CabinetNiveauSeverite.A_CORRIGER })
  @IsEnum(CabinetNiveauSeverite)
  @IsOptional()
  niveau?: CabinetNiveauSeverite;

  @ApiPropertyOptional({ enum: CabinetStatutPointRevue, default: CabinetStatutPointRevue.OUVERT })
  @IsEnum(CabinetStatutPointRevue)
  @IsOptional()
  statut?: CabinetStatutPointRevue;
}

export class UpdateCabinetPointRevueDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  texte?: string;

  @ApiPropertyOptional({ enum: CabinetNiveauSeverite })
  @IsEnum(CabinetNiveauSeverite)
  @IsOptional()
  niveau?: CabinetNiveauSeverite;

  @ApiPropertyOptional({ enum: CabinetStatutPointRevue })
  @IsEnum(CabinetStatutPointRevue)
  @IsOptional()
  statut?: CabinetStatutPointRevue;
}

export class CreateCabinetChecklistControleDto {
  @ApiProperty({ example: 'REVISION_ANNUELLE' })
  @IsString()
  @IsNotEmpty()
  typeMissionCible: string;

  @ApiProperty({ example: 'Checklist Contrôle Clôture et Paie' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiProperty({
    example: [
      { id: '1', libelle: 'Vérification cohérence DADS / Bulletins', obligatoire: true },
      { id: '2', libelle: 'Rapprochement bancaire au centime', obligatoire: true },
    ],
  })
  @IsNotEmpty()
  items: any;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

export class SubmitChecklistItemResultatDto {
  @ApiProperty({ description: 'ID de la mission' })
  @IsUUID()
  @IsNotEmpty()
  cabinetMissionId: string;

  @ApiProperty({ description: 'ID du modèle de checklist' })
  @IsUUID()
  @IsNotEmpty()
  cabinetChecklistControleId: string;

  @ApiProperty({ example: 'Vérification cohérence DADS / Bulletins' })
  @IsString()
  @IsNotEmpty()
  itemLibelle: string;

  @ApiProperty({ enum: CabinetStatutChecklistItem, example: CabinetStatutChecklistItem.CONFORME })
  @IsEnum(CabinetStatutChecklistItem)
  @IsNotEmpty()
  statut: CabinetStatutChecklistItem;

  @ApiPropertyOptional({ example: 'Conforme, vérifié sur grand livre et états déclaratifs.' })
  @IsString()
  @IsOptional()
  commentaire?: string;
}
