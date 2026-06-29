import { ApiProperty } from '@nestjs/swagger';
import { ProfileTenantDto } from './profile-tenant.dto';

export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ type: ProfileTenantDto, description: 'Organisation de l\'utilisateur' })
  tenant!: ProfileTenantDto;

  /** @deprecated Préférer `tenant.id` */
  @ApiProperty()
  tenantId!: string;

  /** @deprecated Préférer `tenant.name` */
  @ApiProperty({ example: 'Acme SARL' })
  tenantName!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isSuperAdmin!: boolean;

  @ApiProperty({ example: ['ADMIN'] })
  roles!: string[];

  @ApiProperty({ example: ['clients.read', 'clients.write'] })
  permissions!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
