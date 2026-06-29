import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantType } from '@prisma/client';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme SARL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: TenantType, default: TenantType.company })
  @IsOptional()
  @IsEnum(TenantType)
  type?: TenantType;
}
