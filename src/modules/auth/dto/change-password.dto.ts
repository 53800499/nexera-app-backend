import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString({ message: 'Le mot de passe actuel est obligatoire.' })
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword!: string;

  @ApiProperty({ minLength: 8, description: 'Nouveau mot de passe' })
  @IsString({ message: 'Le nouveau mot de passe est obligatoire.' })
  @MinLength(8, {
    message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
  })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire.' })
  newPassword!: string;
}
