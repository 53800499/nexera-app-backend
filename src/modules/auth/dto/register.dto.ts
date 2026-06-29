import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { TenantType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'ceo@acme.com' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty({ message: 'L\'adresse email est obligatoire.' })
  email!: string;

  @ApiProperty({ minLength: 8, example: 'MonMotDePasse8' })
  @IsString({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString({ message: 'Le prénom est obligatoire.' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(100, { message: 'Le prénom ne peut pas dépasser 100 caractères.' })
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString({ message: 'Le nom est obligatoire.' })
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères.' })
  lastName!: string;

  @ApiPropertyOptional({
    description: 'UUID d\'une organisation existante (rejoindre)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant d\'organisation invalide.' })
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Nom de la nouvelle entreprise (création) ou recherche par nom',
    example: 'Acme SARL',
  })
  @IsOptional()
  @IsString({ message: 'Le nom de l\'entreprise est invalide.' })
  @MaxLength(100, {
    message: 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères.',
  })
  tenantName?: string;

  @ApiPropertyOptional({
    description:
      'Type d\'organisation à créer (ignoré si tenantId fourni). Défaut : company.',
    enum: TenantType,
    example: TenantType.company,
  })
  @IsOptional()
  @IsEnum(TenantType, {
    message: 'Le type d\'organisation doit être company ou cabinet.',
  })
  tenantType?: TenantType;
}
