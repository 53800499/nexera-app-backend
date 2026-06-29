import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Jeton reçu par email (paramètre `token` du lien front)',
    example: 'xK9mP2nQ7vR4sT1uW8yZ0aB3cD6eF',
  })
  @IsString({ message: 'Le jeton de réinitialisation est obligatoire.' })
  @IsNotEmpty({ message: 'Le jeton de réinitialisation est obligatoire.' })
  token!: string;

  @ApiProperty({
    minLength: 8,
    example: 'MonNouveauMotDePasse8',
    description: 'Nouveau mot de passe (min. 8 caractères)',
  })
  @IsString({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;
}
