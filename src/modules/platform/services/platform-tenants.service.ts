import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import {
  ActivateTenantDto,
  CreateTenantByAdminDto,
  SuspendTenantDto,
  UpdateTenantQuotasDto,
} from '../dto/platform.dto';

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async listTenants(params?: {
    search?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params?.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status && params.status !== 'ALL') {
      where.status = params.status;
    }
    if (params?.type && params.type !== 'ALL') {
      where.type = params.type;
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { id: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, tenants] = await Promise.all([
      (this.prisma as any).tenant.count({ where }),
      (this.prisma as any).tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
    ]);

    return {
      items: tenants.map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status || 'ACTIVE',
        statusReason: t.statusReason,
        suspendedAt: t.suspendedAt,
        suspendedBy: t.suspendedBy,
        cabinetInviteCode: t.cabinetInviteCode,
        maxUsers: t.maxUsers ?? 10,
        storageLimitGb: t.storageLimitGb ?? 5,
        activeModules: t.activeModules || ['COMPTA', 'FACTURATION', 'CRM', 'RH', 'IMMO', 'TRESORERIE'],
        usersCount: t._count?.users || 0,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTenantDetail(id: string) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isSuperAdmin: true,
            createdAt: true,
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        cabinetLinks: {
          include: {
            companyTenant: {
              select: { id: true, name: true },
            },
          },
        },
        companyLinks: {
          include: {
            cabinetTenant: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Entreprise avec l'identifiant ${id} introuvable`);
    }

    // Recent audit actions regarding this tenant
    const auditLogs = await (this.prisma as any).platformAuditLog.findMany({
      where: {
        targetEntity: 'Tenant',
        targetId: id,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...tenant,
      status: tenant.status || 'ACTIVE',
      users: tenant.users.map((u: any) => ({
        ...u,
        roles: u.roles.map((r: any) => r.role.code),
      })),
      auditLogs,
    };
  }

  async suspendTenant(
    id: string,
    dto: SuspendTenantDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Entreprise introuvable`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new BadRequestException(`Cette entreprise est déjà suspendue.`);
    }

    const updated = await (this.prisma as any).tenant.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        statusReason: dto.reason,
        suspendedAt: new Date(),
        suspendedBy: adminUser.email,
      },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'TENANT_SUSPENDED',
      targetEntity: 'Tenant',
      targetId: id,
      targetLabel: tenant.name,
      details: { reason: dto.reason },
      ipAddress,
    });

    return {
      success: true,
      message: `L'entreprise « ${tenant.name} » a été suspendue avec succès.`,
      tenant: updated,
    };
  }

  async activateTenant(
    id: string,
    dto: ActivateTenantDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Entreprise introuvable`);
    }

    const updated = await (this.prisma as any).tenant.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        statusReason: null,
        suspendedAt: null,
        suspendedBy: null,
      },
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'TENANT_ACTIVATED',
      targetEntity: 'Tenant',
      targetId: id,
      targetLabel: tenant.name,
      details: { reason: dto.reason || 'Réactivation manuelle Super Admin' },
      ipAddress,
    });

    return {
      success: true,
      message: `L'entreprise « ${tenant.name} » a été réactivée avec succès.`,
      tenant: updated,
    };
  }

  async createTenant(
    dto: CreateTenantByAdminDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const existingUser = await (this.prisma as any).user.findUnique({
      where: { email: dto.adminEmail.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new BadRequestException(
        `Un compte utilisateur existe déjà avec l'adresse e-mail « ${dto.adminEmail} ».`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
    const defaultModules = dto.activeModules?.length
      ? dto.activeModules
      : ['COMPTA', 'FACTURATION', 'CRM', 'RH', 'IMMO', 'TRESORERIE'];

    const newTenant = await (this.prisma as any).tenant.create({
      data: {
        name: dto.name.trim(),
        type: dto.type || 'company',
        status: 'ACTIVE',
        maxUsers: dto.maxUsers || 10,
        storageLimitGb: dto.storageLimitGb || 5,
        activeModules: defaultModules,
        users: {
          create: {
            email: dto.adminEmail.toLowerCase().trim(),
            password: hashedPassword,
            firstName: dto.adminFirstName.trim(),
            lastName: dto.adminLastName.trim(),
            isActive: true,
            isSuperAdmin: false,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const initialAdmin = newTenant.users[0];

    // Attribuer le rôle Dirigeant / Admin au premier utilisateur
    const adminRole = await (this.prisma as any).role.findFirst({
      where: { code: 'ADMIN' },
    });
    if (adminRole && initialAdmin) {
      await (this.prisma as any).userRole.create({
        data: {
          userId: initialAdmin.id,
          roleId: adminRole.id,
        },
      }).catch(() => null);
    }

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'TENANT_CREATED_BY_ADMIN',
      targetEntity: 'Tenant',
      targetId: newTenant.id,
      targetLabel: `${newTenant.name} (${dto.adminEmail})`,
      details: {
        type: newTenant.type,
        maxUsers: newTenant.maxUsers,
        storageLimitGb: newTenant.storageLimitGb,
        activeModules: newTenant.activeModules,
      },
      ipAddress,
    });

    return {
      success: true,
      message: `L'entreprise « ${newTenant.name} » et son administrateur principal ont été créés avec succès.`,
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        type: newTenant.type,
        status: newTenant.status,
        maxUsers: newTenant.maxUsers,
        storageLimitGb: newTenant.storageLimitGb,
        activeModules: newTenant.activeModules,
        adminUser: {
          id: initialAdmin?.id,
          email: initialAdmin?.email,
          fullName: `${dto.adminFirstName} ${dto.adminLastName}`,
        },
      },
    };
  }

  async updateQuotas(
    id: string,
    dto: UpdateTenantQuotasDto,
    adminUser: { id: string; email: string },
    ipAddress?: string,
  ) {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Entreprise introuvable.`);
    }

    const data: any = {};
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;
    if (dto.storageLimitGb !== undefined) data.storageLimitGb = dto.storageLimitGb;
    if (dto.activeModules !== undefined) data.activeModules = dto.activeModules;

    const updated = await (this.prisma as any).tenant.update({
      where: { id },
      data,
    });

    await this.auditService.logAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'TENANT_QUOTAS_UPDATED',
      targetEntity: 'Tenant',
      targetId: id,
      targetLabel: tenant.name,
      details: {
        previousQuotas: {
          maxUsers: tenant.maxUsers,
          storageLimitGb: tenant.storageLimitGb,
          activeModules: tenant.activeModules,
        },
        newQuotas: data,
      },
      ipAddress,
    });

    return {
      success: true,
      message: `Les quotas et modules de « ${tenant.name} » ont été mis à jour avec succès.`,
      tenant: updated,
    };
  }

  async exportTenants() {
    const tenants = await (this.prisma as any).tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return tenants.map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status || 'ACTIVE',
      usersCount: t._count?.users || 0,
      maxUsers: t.maxUsers ?? 10,
      storageLimitGb: t.storageLimitGb ?? 5,
      activeModules: (t.activeModules || []).join('; '),
      cabinetInviteCode: t.cabinetInviteCode || '',
      createdAt: new Date(t.createdAt).toISOString(),
    }));
  }
}

