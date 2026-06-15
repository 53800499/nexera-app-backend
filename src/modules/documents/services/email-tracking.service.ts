import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class EmailTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('EMAIL_TRACKING_ENABLED', 'false') === 'true';
  }

  async createTracking(
    tenantId: string,
    documentType: string,
    documentId: string,
    recipientEmail: string,
  ) {
    const trackingId = randomUUID();
    await this.prisma.emailTracking.create({
      data: {
        trackingId,
        tenantId,
        documentType,
        documentId,
        recipientEmail,
      },
    });
    return {
      trackingId,
      pixelUrl: this.buildPixelUrl(trackingId),
    };
  }

  buildPixelUrl(trackingId: string): string {
    const base =
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/public/track/${trackingId}`;
  }

  async recordOpen(trackingId: string) {
    const record = await this.prisma.emailTracking.findUnique({
      where: { trackingId },
    });
    if (!record) return null;

    if (!record.openedAt) {
      await this.prisma.emailTracking.update({
        where: { id: record.id },
        data: { openedAt: new Date() },
      });
    }
    return record;
  }

  buildHtmlWithPixel(html: string, pixelUrl: string): string {
    return `${html}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  }
}
