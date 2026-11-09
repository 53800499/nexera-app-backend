import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { CreateIncidentDto, UpdateIncidentDto } from '../dto/platform.dto';

@Injectable()
export class PlatformIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async listIncidents() {
    return (this.prisma as any).platformIncident.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createIncident(
    dto: CreateIncidentDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const incident = await (this.prisma as any).platformIncident.create({
      data: {
        title: dto.title,
        severity: dto.severity || 'MEDIUM',
        status: 'INVESTIGATING',
        impactedService: dto.impactedService,
        description: dto.description,
      },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'INCIDENT_DECLARED',
      targetEntity: 'Incident',
      targetId: incident.id,
      targetLabel: dto.title,
      details: { severity: dto.severity, service: dto.impactedService },
      ipAddress,
    });

    return incident;
  }

  async updateIncident(
    id: string,
    dto: UpdateIncidentDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const existing = await (this.prisma as any).platformIncident.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Incident introuvable`);
    }

    const data: any = {};
    if (dto.title) data.title = dto.title;
    if (dto.severity) data.severity = dto.severity;
    if (dto.description) data.description = dto.description;
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'RESOLVED' && !existing.resolvedAt) {
        data.resolvedAt = new Date();
      }
    }

    const updated = await (this.prisma as any).platformIncident.update({
      where: { id },
      data,
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'INCIDENT_UPDATED',
      targetEntity: 'Incident',
      targetId: id,
      targetLabel: updated.title,
      details: { newStatus: dto.status, updates: dto },
      ipAddress,
    });

    return updated;
  }
}

