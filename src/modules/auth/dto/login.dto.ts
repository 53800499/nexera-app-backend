import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
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
}
