import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Début de période (défaut : 1er jour du mois courant)',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description: 'Fin de période (défaut : dernier jour du mois courant)',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}
