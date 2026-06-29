import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jean' })
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  lastName!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  tenantId!: string;

  @ApiProperty({ enum: ['company', 'cabinet'], example: 'company' })
  tenantType!: string;

  @ApiProperty({ example: ['ADMIN'] })
  roles!: string[];

  @ApiProperty({ example: ['clients.read', 'clients.write'] })
  permissions!: string[];
}

export class AuthTokensResponseDto {
  @ApiProperty({ description: 'JWT access token (15 min par défaut)' })
  access_token!: string;

  @ApiProperty({ description: 'JWT refresh token (7 jours par défaut)' })
  refresh_token!: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({
    example: 'Si un compte existe pour cette adresse email, les instructions ont été envoyées.',
  })
  message!: string;
}
