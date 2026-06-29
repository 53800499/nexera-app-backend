import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Adresse email du compte',
  })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty({ message: 'L\'adresse email est obligatoire.' })
  email!: string;
}
