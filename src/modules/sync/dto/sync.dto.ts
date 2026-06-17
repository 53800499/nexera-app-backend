import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SyncEntityType } from '../enums/sync-entity-type.enum';
import { SyncOperation } from '../enums/sync-operation.enum';

export class SyncPullQueryDto {
  @ApiPropertyOptional({
    description: 'Curseur opaque renvoyé par le pull précédent',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 200, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'Identifiant appareil (suivi lastPullAt)' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Réponse gzip (ou via Accept-Encoding: gzip)',
    default: false,
  })
  @IsOptional()
  compress?: boolean;
}

export class SyncMutationDto {
  @ApiProperty({ description: 'Clé idempotente côté client (UUID)' })
  @IsUUID()
  mutationId!: string;

  @ApiProperty({ enum: SyncEntityType })
  @IsEnum(SyncEntityType)
  entityType!: SyncEntityType;

  @ApiProperty({ enum: SyncOperation })
  @IsEnum(SyncOperation)
  operation!: SyncOperation;

  @ApiPropertyOptional({ description: 'ID serveur (update/delete)' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'ID local temporaire (create)' })
  @IsString()
  @IsOptional()
  localId?: string;

  @ApiPropertyOptional({
    description: 'updatedAt ISO connu côté client — détection de conflit',
  })
  @IsDateString()
  @IsOptional()
  baseVersion?: string;

  @ApiProperty({ description: 'Corps métier (DTO create/update)' })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncPushDto {
  @ApiProperty({ description: 'Identifiant stable de l\'appareil' })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Nom affiché de l\'appareil' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiProperty({ description: 'ID de lot pour traçabilité' })
  @IsUUID()
  batchId!: string;

  @ApiProperty({ type: [SyncMutationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations!: SyncMutationDto[];
}
