import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GlobalSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Terme de recherche multi-entités (client, facture, devis, commande, article, employé)',
    example: 'FAC-2026',
  })
  @IsOptional()
  @IsString()
  q?: string;
}

export interface SearchItemResult {
  id: string;
  type: 'client' | 'quotation' | 'invoice' | 'order' | 'catalog' | 'employe';
  title: string;
  subtitle: string;
  code?: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  meta?: string;
  href: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalMatches: number;
  clients: SearchItemResult[];
  quotations: SearchItemResult[];
  invoices: SearchItemResult[];
  orders: SearchItemResult[];
  catalogItems: SearchItemResult[];
  employes: SearchItemResult[];
}
