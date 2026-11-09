import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { ResetUserPasswordDto, ToggleSuperAdminDto, ToggleUserStatusDto } from '../dto/platform.dto';
import { PasswordResetService } from '../../auth/password-reset.service';

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  async listUsers(params?: {
    search?: string;
    isActive?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params?.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.isActive !== undefined && params.isActive !== 'ALL') {
      where.isActive = params.isActive === 'true';
    }
    if (params?.tenantId) {
      where.tenantId = params.tenantId;
    }
    if (params?.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { tenant: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, users] = await Promise.all([
      (this.prisma as any).user.count({ where }),
      (this.prisma as any).user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          lastLoginIp: true,
          twoFactorEnabled: true,
          tenant: {
            select: {
              id: true,
              name: true,
              status: true,
              type: true,
            },
          },
          roles: {
            select: {
              role: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName} ${u.lastName}`.trim(),
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : (u.updatedAt ? u.updatedAt.toISOString() : null),
        lastLoginIp: u.lastLoginIp || null,
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        tenantId: u.tenant?.id,
        tenantName: u.tenant?.name || 'Inconnue',
        tenantStatus: u.tenant?.status || 'ACTIVE',
        roles: u.roles.map((r: any) => r.role.code),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async toggleUserStatus(
    id: string,
    dto: ToggleUserStatusDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable`);
    }

    if (user.isSuperAdmin && !dto.isActive) {
      throw new BadRequestException(`Impossible de désactiver un compte Super Administrateur.`);
    }

    const updated = await (this.prisma as any).user.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: dto.isActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
      targetEntity: 'User',
      targetId: id,
      targetLabel: `${user.email} (${user.tenant?.name || ''})`,
      details: {
        previousState: user.isActive,
        newState: dto.isActive,
        reason: dto.reason || 'Action manuelle Super Admin',
      },
      ipAddress,
    });

    return {
      success: true,
      message: dto.isActive
        ? `Le compte de « ${user.email} » a été débloqué.`
        : `Le compte de « ${user.email} » a été suspendu.`,
      user: {
        id: updated.id,
        email: updated.email,
        isActive: updated.isActive,
      },
    };
  }

  async sendPasswordReset(
    id: string,
    dto: ResetUserPasswordDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable`);
    }

    const method = dto?.method || 'EMAIL';

    // 1. Si mode manuel : mise à jour directe du mot de passe
    if (method === 'MANUAL') {
      if (!dto?.newPassword || dto.newPassword.length < 8) {
        throw new BadRequestException('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      }
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await (this.prisma as any).user.update({
        where: { id },
        data: {
          password: hashedPassword,
          refreshToken: null, // Invalide les sessions actives
        },
      });

      await this.auditService.logAction({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'USER_PASSWORD_MANUALLY_RESET',
        targetEntity: 'User',
        targetId: id,
        targetLabel: `${user.email} (${user.tenant?.name || ''})`,
        details: { method: 'MANUAL' },
        ipAddress,
      });

      return {
        success: true,
        method: 'MANUAL',
        message: `Le mot de passe de « ${user.email} » a été mis à jour avec succès. Ses sessions actives ont été déconnectées.`,
      };
    }

    // 2. Génération du token de réinitialisation sécurisé
    const rawToken = await this.passwordResetService.issueResetToken(user.id);
    const resetUrl = this.passwordResetService.getResetUrl(rawToken);

    let mailSent = false;
    let mailError: string | null = null;

    if (method === 'EMAIL') {
      try {
        const mailResult = await this.passwordResetService.sendResetEmail(user, rawToken);
        mailSent = mailResult?.sent ?? false;
        if (!mailSent) {
          mailError = mailResult?.reason || 'Erreur inconnue de transmission mail';
        }
      } catch (err: any) {
        mailSent = false;
        mailError = err?.message || 'Serveur SMTP non disponible';
      }
    }

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'USER_PASSWORD_RESET_TRIGGERED',
      targetEntity: 'User',
      targetId: id,
      targetLabel: `${user.email} (${user.tenant?.name || ''})`,
      details: {
        method,
        mailSent,
        mailError,
      },
      ipAddress,
    });

    const responseMsg = mailSent
      ? `Un e-mail de réinitialisation sécurisé a été transmis à ${user.email}.`
      : method === 'LINK'
        ? `Lien direct de réinitialisation généré avec succès.`
        : `L'envoi par e-mail n'a pas pu aboutir (${mailError || 'problème SMTP'}), mais le lien sécurisé direct a été généré ci-dessous.`;

    return {
      success: true,
      method,
      mailSent,
      resetUrl,
      message: responseMsg,
    };
  }

  async toggleSuperAdmin(
    id: string,
    dto: ToggleSuperAdminDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable.`);
    }

    // Sécurité : Interdire l'auto-rétrogradation si c'est soi-même
    if (user.id === adminUser.id && !dto.isSuperAdmin) {
      throw new BadRequestException(
        `Impossible de révoquer vos propres privilèges de Super Administrateur.`,
      );
    }

    // Sécurité : S'assurer qu'il reste toujours au moins un Super Admin actif
    if (!dto.isSuperAdmin) {
      const otherSuperAdminsCount = await (this.prisma as any).user.count({
        where: {
          isSuperAdmin: true,
          isActive: true,
          id: { not: id },
        },
      });

      if (otherSuperAdminsCount === 0) {
        throw new BadRequestException(
          `Action bloquée : au moins un Super Administrateur actif doit être conservé sur la plateforme.`,
        );
      }
    }

    const updated = await (this.prisma as any).user.update({
      where: { id },
      data: { isSuperAdmin: dto.isSuperAdmin },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: dto.isSuperAdmin ? 'USER_SUPERADMIN_PROMOTED' : 'USER_SUPERADMIN_REVOKED',
      targetEntity: 'User',
      targetId: id,
      targetLabel: user.email,
      details: {
        previousState: user.isSuperAdmin,
        newState: dto.isSuperAdmin,
        reason: dto.reason || 'Action manuelle Super Admin',
      },
      ipAddress,
    });

    return {
      success: true,
      message: dto.isSuperAdmin
        ? `L'utilisateur « ${user.email} » a été promu Super Administrateur.`
        : `Les privilèges Super Administrateur ont été retirés à « ${user.email} ».`,
      user: {
        id: updated.id,
        email: updated.email,
        isSuperAdmin: updated.isSuperAdmin,
      },
    };
  }

  async revokeSessions(
    id: string,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable.`);
    }

    await (this.prisma as any).user.update({
      where: { id },
      data: { refreshToken: null },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'USER_SESSIONS_REVOKED',
      targetEntity: 'User',
      targetId: id,
      targetLabel: user.email,
      details: { forceLogout: true },
      ipAddress,
    });

    return {
      success: true,
      message: `Toutes les sessions actives de « ${user.email} » ont été invalidées. La reconnexion sera exigée.`,
    };
  }

  async reset2FA(
    id: string,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable.`);
    }

    await (this.prisma as any).user.update({
      where: { id },
      data: { twoFactorEnabled: false },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'USER_2FA_RESET',
      targetEntity: 'User',
      targetId: id,
      targetLabel: user.email,
      details: { twoFactorReset: true },
      ipAddress,
    });

    return {
      success: true,
      message: `L'authentification 2FA a été réinitialisée pour « ${user.email} ».`,
    };
  }

  async getUserActivity(id: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, type: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable.`);
    }

    const auditLogs = await (this.prisma as any).platformAuditLog.findMany({
      where: {
        OR: [{ targetId: id }, { adminUserId: id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        twoFactorEnabled: user.twoFactorEnabled,
        tenant: user.tenant,
      },
      auditLogs,
      logs: auditLogs,
    };
  }
}

