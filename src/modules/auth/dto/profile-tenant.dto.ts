import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileTenantDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id!: string;

  @ApiProperty({ example: 'Acme SARL' })
  name!: string;

  @ApiProperty({ enum: ['company', 'cabinet'], example: 'company' })
  type!: string;

  @ApiPropertyOptional({ example: 'Acme Société à Responsabilité Limitée' })
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'Acme' })
  tradeName?: string | null;

  @ApiProperty({ example: 'EUR' })
  primaryCurrency!: string;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  companyEmail?: string | null;
}
