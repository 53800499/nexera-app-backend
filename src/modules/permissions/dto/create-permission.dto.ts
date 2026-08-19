import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'manage:users', description: 'Code technique de la permission' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Permet de créer, modifier et supprimer des utilisateurs', description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;
}
