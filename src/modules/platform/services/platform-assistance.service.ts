import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { CreateAssistanceSessionDto, RevokeAssistanceSessionDto } from '../dto/platform.dto';

@Injectable()
export class PlatformAssistanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async listSessions() {
    const sessions = await (this.prisma as any).platformAssistanceSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    return sessions.map((s: any) => {
      const isExpired = new Date(s.expiresAt) <= now;
      const status = s.revokedAt ? 'REVOKED' : isExpired ? 'EXPIRED' : s.status;
      return {
        ...s,
        status,
        remainingMinutes:
          status === 'ACTIVE'
            ? Math.max(0, Math.round((new Date(s.expiresAt).getTime() - now.getTime()) / 60000))
            : 0,
      };
    });
  }

  async initiateSession(
    dto: CreateAssistanceSessionDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: dto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Entreprise introuvable.`);
    }

    const duration = dto.durationMinutes || 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 60 * 1000);

    // Scoped assistance token allowing restricted support viewing
    const assistancePayload = {
      sub: adminUser.id,
      email: adminUser.email,
      tenantId: tenant.id,
      tenantType: tenant.type,
      roles: ['SUPER_ADMIN', 'PLATFORM_SUPPORT'],
      permissions: ['*'],
      isSuperAdmin: true,
      isAssistanceSession: true,
      ticketRef: dto.ticketRef,
      justification: dto.justification,
    };

    const sessionToken = this.jwt.sign(assistancePayload, {
      expiresIn: `${duration}m`,
      secret: this.config.get('JWT_SECRET'),
    });

    const session = await (this.prisma as any).platformAssistanceSession.create({
      data: {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        tenantId: tenant.id,
        tenantName: tenant.name,
        ticketRef: dto.ticketRef,
        justification: dto.justification,
        durationMinutes: duration,
        status: 'ACTIVE',
        startedAt: now,
        expiresAt,
        sessionToken,
        ipAddress,
      },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'ASSISTANCE_SESSION_INITIATED',
      targetEntity: 'Tenant',
      targetId: tenant.id,
      targetLabel: `${tenant.name} (${dto.ticketRef})`,
      details: {
        ticketRef: dto.ticketRef,
        justification: dto.justification,
        durationMinutes: duration,
        sessionId: session.id,
      },
      ipAddress,
    });

    return {
      success: true,
      message: `Session d'assistance autorisée pour « ${tenant.name} » d'une durée de ${duration} minutes.`,
      session: {
        id: session.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        ticketRef: session.ticketRef,
        expiresAt: session.expiresAt,
        sessionToken,
      },
    };
  }

  async revokeSession(
    sessionId: string,
    dto: RevokeAssistanceSessionDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const session = await (this.prisma as any).platformAssistanceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session d'assistance introuvable.`);
    }

    if (session.status !== 'ACTIVE' || session.revokedAt) {
      throw new BadRequestException(`Cette session est déjà inactive ou révoquée.`);
    }

    const updated = await (this.prisma as any).platformAssistanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: adminUser.email,
      },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'ASSISTANCE_SESSION_REVOKED',
      targetEntity: 'AssistanceSession',
      targetId: sessionId,
      targetLabel: `${session.tenantName || session.tenantId} (${session.ticketRef})`,
      details: { reason: dto.reason || 'Révocation manuelle' },
      ipAddress,
    });

    return {
      success: true,
      message: `La session d'assistance a été révoquée immédiatement.`,
      session: updated,
    };
  }
}

