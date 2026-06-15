import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateReminderSettingsDto {
  @ApiPropertyOptional({ description: 'Activer/désactiver les relances automatiques' })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 3, description: 'Niveau 1 — Rappel (J+N après échéance)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  level1DaysAfterDue?: number;

  @ApiPropertyOptional({ example: 15, description: 'Niveau 2 — Relance' })
  @IsInt()
  @Min(0)
  @IsOptional()
  level2DaysAfterDue?: number;

  @ApiPropertyOptional({ example: 30, description: 'Niveau 3 — Mise en demeure' })
  @IsInt()
  @Min(0)
  @IsOptional()
  level3DaysAfterDue?: number;

  @ApiPropertyOptional({ description: 'Copie au responsable commercial (niveau 2)' })
  @IsBoolean()
  @IsOptional()
  level2CopyCommercial?: boolean;

  @ApiPropertyOptional({ description: 'Alerte au dirigeant (niveau 3)' })
  @IsBoolean()
  @IsOptional()
  level3AlertDirector?: boolean;

  @ApiPropertyOptional({ description: 'Bloquer nouveaux devis/commandes (niveau 3)' })
  @IsBoolean()
  @IsOptional()
  level3BlockNewOrders?: boolean;

  @ApiPropertyOptional({ example: 'commercial@entreprise.fr' })
  @IsEmail()
  @IsOptional()
  commercialEmail?: string;

  @ApiPropertyOptional({ example: 'dirigeant@entreprise.fr' })
  @IsEmail()
  @IsOptional()
  directorEmail?: string;
}
