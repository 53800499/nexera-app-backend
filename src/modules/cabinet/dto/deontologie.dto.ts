import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CabinetDecisionConflit } from '@prisma/client';

export class CreateCabinetConflitInteretDto {
  @ApiProperty({ description: 'ID du mandat client concerné' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'Lien familial direct avec le directeur financier de l’entreprise cliente.' })
  @IsString()
  @IsNotEmpty()
  natureConflit: string;
}

export class ArbitrerCabinetConflitInteretDto {
  @ApiProperty({ enum: CabinetDecisionConflit, example: CabinetDecisionConflit.RETRAIT_DU_DOSSIER })
  @IsEnum(CabinetDecisionConflit)
  @IsNotEmpty()
  decision: CabinetDecisionConflit;

  @ApiPropertyOptional({ example: 'Réaffectation du dossier à un autre collaborateur senior.' })
  @IsString()
  @IsOptional()
  commentaireDecision?: string;
}

export class LogCabinetAccesSecretProDto {
  @ApiProperty({ description: 'ID du mandat client consulté' })
  @IsUUID()
  @IsNotEmpty()
  cabinetClientMandatId: string;

  @ApiProperty({ example: 'M4_RH_PAIE' })
  @IsString()
  @IsNotEmpty()
  moduleConsulte: string;

  @ApiPropertyOptional({ example: 'Revue des bulletins de paie et du cycle social' })
  @IsString()
  @IsOptional()
  actionRealisee?: string;
}
