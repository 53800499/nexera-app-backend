import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty({ message: 'L\'adresse email est obligatoire.' })
  email!: string;

  @IsString({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;

  @IsString({ message: 'Le prénom est obligatoire.' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(100, { message: 'Le prénom ne peut pas dépasser 100 caractères.' })
  firstName!: string;

  @IsString({ message: 'Le nom est obligatoire.' })
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères.' })
  lastName!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Identifiant d\'organisation invalide.' })
  tenantId?: string;

  @IsOptional()
  @IsString({ message: 'Le nom de l\'entreprise est invalide.' })
  @MaxLength(100, {
    message: 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères.',
  })
  tenantName?: string;
}
