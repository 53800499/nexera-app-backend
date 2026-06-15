import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const DEFAULT_TTL_DAYS = 30;

@Injectable()
export class DocumentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createToken(
    tenantId: string,
    documentType: string,
    documentId: string,
    ttlDays = DEFAULT_TTL_DAYS,
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await this.prisma.documentAccessToken.create({
      data: {
        token,
        tenantId,
        documentType,
        documentId,
        expiresAt,
      },
    });

    return {
      token,
      downloadUrl: this.buildDownloadUrl(token),
      expiresAt,
    };
  }

  buildDownloadUrl(token: string): string {
    const base =
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/public/documents/${token}`;
  }

  async resolveToken(token: string) {
    const record = await this.prisma.documentAccessToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new NotFoundException('Lien de téléchargement invalide ou expiré');
    }

    if (!record.openedAt) {
      await this.prisma.documentAccessToken.update({
        where: { id: record.id },
        data: { openedAt: new Date() },
      });
    }

    return record;
  }
}
