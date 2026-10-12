import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistrer une trace d'audit comptable
   */
  async tracer(
    tenantId: string,
    categorie: string,
    action: string,
    acteurId: string,
    options?: {
      entiteType?: string;
      entiteId?: string;
      detailsJson?: any;
    },
  ) {
    return (this.prisma as any).comptaJournalAudit.create({
      data: {
        tenantId,
        categorie,
        action,
        acteurId,
        entiteType: options?.entiteType || null,
        entiteId: options?.entiteId || null,
        detailsJson: options?.detailsJson || null,
      },
    });
  }

  /**
   * UC-20 : Consulter le journal d'audit
   */
  async getJournalAudit(
    tenantId: string,
    filters: {
      categorie?: string;
      action?: string;
      entiteType?: string;
      dateDebut?: string;
      dateFin?: string;
      limite?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters.categorie) where.categorie = filters.categorie;
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.entiteType) where.entiteType = filters.entiteType;
    if (filters.dateDebut || filters.dateFin) {
      where.horodatage = {};
      if (filters.dateDebut) where.horodatage.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.horodatage.lte = new Date(filters.dateFin);
    }

    return (this.prisma as any).comptaJournalAudit.findMany({
      where,
      orderBy: { horodatage: 'desc' },
      take: filters.limite || 100,
    });
  }
}
