import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString({ message: 'Le prénom est invalide.' })
  @IsNotEmpty({ message: 'Le prénom ne peut pas être vide.' })
  @MaxLength(100, { message: 'Le prénom ne peut pas dépasser 100 caractères.' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsOptional()
  @IsString({ message: 'Le nom est invalide.' })
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide.' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères.' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'jean.dupont@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email?: string;
}
