import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Jeton reçu par email (query param du lien front)' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8, example: 'NewSecure1!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
