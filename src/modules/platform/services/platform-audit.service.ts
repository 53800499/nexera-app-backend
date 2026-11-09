import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface RecordPlatformAuditParams {
  adminUserId?: string;
  adminEmail?: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(params: RecordPlatformAuditParams) {
    try {
      return await (this.prisma as any).platformAuditLog.create({
        data: {
          adminUserId: params.adminUserId,
          adminEmail: params.adminEmail,
          action: params.action,
          targetEntity: params.targetEntity,
          targetId: params.targetId,
          targetLabel: params.targetLabel,
          details: params.details || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error: any) {
      this.logger.error(`Erreur d'enregistrement dans le journal d'audit: ${error.message}`, error.stack);
      return null;
    }
  }

  async getLogs(filters?: {
    action?: string;
    targetEntity?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters?.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.targetEntity) {
      where.targetEntity = filters.targetEntity;
    }
    if (filters?.search) {
      where.OR = [
        { adminEmail: { contains: filters.search, mode: 'insensitive' } },
        { action: { contains: filters.search, mode: 'insensitive' } },
        { targetLabel: { contains: filters.search, mode: 'insensitive' } },
        { targetEntity: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      (this.prisma as any).platformAuditLog.count({ where }),
      (this.prisma as any).platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

