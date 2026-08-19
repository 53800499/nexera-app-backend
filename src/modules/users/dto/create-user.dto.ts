import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsArray,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'collab@nexera.bj', description: 'Adresse email de connexion' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: 'Secret123!', description: 'Mot de passe initial (min 8 caractères)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'Jean', description: 'Prénom' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'KOUASSI', description: 'Nom de famille' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ description: 'Identifiant du tenant (assigné automatiquement)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ example: true, description: 'Compte actif' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Demander le changement de mot de passe à la première connexion' })
  @IsBoolean()
  @IsOptional()
  requestPasswordReset?: boolean;

  @ApiPropertyOptional({ example: ['uuid-role-1'], description: 'Identifiants des rôles à assigner' })
  @IsUUID('4', { each: true })
  @IsArray()
  @IsOptional()
  roleIds?: string[];
}
