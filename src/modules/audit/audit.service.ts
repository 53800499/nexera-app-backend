import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditAction, AuditEntityType } from './enums/audit.enum';

export interface AuditRecordInput {
  tenantId: string;
  userId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Journal immuable — INSERT uniquement. */
  async record(input: AuditRecordInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async findByEntity(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId, entityType, entityId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where: { tenantId, entityType, entityId },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
