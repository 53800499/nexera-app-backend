import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RevokeCabinetAccessDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Identifiant du cabinet à révoquer (valeur `id` retournée par GET /cabinet/access).',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @IsUUID('4', { message: 'Identifiant de cabinet invalide.' })
  cabinetTenantId!: string;
}
