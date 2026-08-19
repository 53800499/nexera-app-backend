import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Responsable Commercial', description: 'Nom lisible du rôle' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'COMMERCIAL_MGR', description: 'Code technique unique' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Gestion des devis, factures et suivi clients', description: 'Description du rôle' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Identifiant du tenant' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiPropertyOptional({ example: ['uuid-perm-1'], description: 'Permissions initiales à attacher au rôle' })
  @IsUUID('4', { each: true })
  @IsArray()
  @IsOptional()
  permissionIds?: string[];
}
