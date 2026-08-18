import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditAction } from '@prisma/client';

@Injectable()
export class RhAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    utilisateurId?: string;
    entiteNom: string;
    entiteId?: string;
    actionAudit: RhAuditAction;
    champsModifiesJson?: any;
    adresseIp?: string;
    userAgent?: string;
  }) {
    try {
      return await this.prisma.rhJournalAudit.create({
        data: {
          tenantId: params.tenantId,
          utilisateurId: params.utilisateurId,
          entiteNom: params.entiteNom,
          entiteId: params.entiteId,
          actionAudit: params.actionAudit,
          champsModifiesJson: params.champsModifiesJson ?? null,
          adresseIp: params.adresseIp,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Non-blocking audit failure logger
      console.error('Failed to write RH audit log:', error);
      return null;
    }
  }

  async findLogs(tenantId: string, entiteNom?: string, limit = 50) {
    return this.prisma.rhJournalAudit.findMany({
      where: {
        tenantId,
        ...(entiteNom ? { entiteNom } : {}),
      },
      orderBy: { dateAction: 'desc' },
      take: limit,
    });
  }
}
