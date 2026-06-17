import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SyncPushDto } from './dto/sync.dto';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly pullService: SyncPullService,
    private readonly pushService: SyncPushService,
    private readonly prisma: PrismaService,
  ) {}

  bootstrap(tenantId: string) {
    return this.pullService.bootstrap(tenantId);
  }

  async pull(
    tenantId: string,
    userId: string,
    deviceId: string | undefined,
    cursor?: string,
    limit?: number,
  ) {
    const result = await this.pullService.pull(tenantId, cursor, limit);

    if (deviceId) {
      await this.prisma.syncDevice.upsert({
        where: {
          tenantId_userId_deviceId: { tenantId, userId, deviceId },
        },
        create: {
          tenantId,
          userId,
          deviceId,
          lastPullAt: new Date(),
        },
        update: { lastPullAt: new Date() },
      });
    }

    return result;
  }

  push(tenantId: string, userId: string, dto: SyncPushDto) {
    return this.pushService.push(tenantId, userId, dto);
  }
}
