import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSystemHealth() {
    const startTime = Date.now();
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;
    let dbError: string | null = null;

    try {
      await (this.prisma as any).$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (err: any) {
      dbStatus = 'DEGRADED';
      dbError = err.message || 'Database query error';
      this.logger.error(`Health check database failure: ${dbError}`);
    }

    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    // Approximate database stats
    const [tenantsCount, usersCount] = await Promise.all([
      (this.prisma as any).tenant.count().catch(() => 0),
      (this.prisma as any).user.count().catch(() => 0),
    ]);

    return {
      status: dbStatus === 'HEALTHY' ? 'ONLINE' : 'DEGRADED',
      checkedAt: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        engine: 'PostgreSQL',
        error: dbError,
        records: {
          tenants: tenantsCount,
          users: usersCount,
        },
      },
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds,
        uptimeFormatted: this.formatUptime(uptimeSeconds),
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      },
      services: {
        mailService: 'Brevo (API HTTPS / SMTP Fallback)',
        security: 'OWASP Multi-tenant Isolation Active',
      },
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  }
}
