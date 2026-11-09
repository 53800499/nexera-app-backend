import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalTenants,
      suspendedTenants,
      newTenantsThisMonth,
      newTenantsPrevMonth,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      activeAssistanceSessions,
      openIncidents,
      recentTenants,
    ] = await Promise.all([
      (this.prisma as any).tenant.count(),
      (this.prisma as any).tenant.count({
        where: { status: 'SUSPENDED' },
      }),
      (this.prisma as any).tenant.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      (this.prisma as any).tenant.count({
        where: {
          createdAt: {
            gte: startOfPrevMonth,
            lt: startOfMonth,
          },
        },
      }),
      (this.prisma as any).user.count(),
      (this.prisma as any).user.count({
        where: { isActive: true },
      }),
      (this.prisma as any).user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      (this.prisma as any).platformAssistanceSession.count({
        where: { status: 'ACTIVE', expiresAt: { gt: now } },
      }),
      (this.prisma as any).platformIncident.count({
        where: { status: { not: 'RESOLVED' } },
      }),
      (this.prisma as any).tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true },
          },
        },
      }),
    ]);

    const activeTenants = totalTenants - suspendedTenants;
    const tenantGrowthRate =
      newTenantsPrevMonth > 0
        ? Math.round(((newTenantsThisMonth - newTenantsPrevMonth) / newTenantsPrevMonth) * 100)
        : newTenantsThisMonth > 0
          ? 100
          : 0;

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
        newThisMonth: newTenantsThisMonth,
        growthRatePct: tenantGrowthRate,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: totalUsers - activeUsers,
        newThisMonth: newUsersThisMonth,
      },
      operations: {
        activeAssistanceSessions,
        openIncidents,
      },
      recentTenants: recentTenants.map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status || 'ACTIVE',
        usersCount: t._count?.users || 0,
        createdAt: t.createdAt,
      })),
    };
  }

  async getRecentActivity(limit = 10) {
    return (this.prisma as any).platformAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

