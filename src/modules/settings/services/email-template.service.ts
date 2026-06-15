import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EmailTemplateType } from '../enums/email-template-type.enum';
import { DEFAULT_EMAIL_TEMPLATES } from '../constants/default-settings.constants';
import { renderTemplate } from '../utils/template-render.util';

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { type: 'asc' },
    });

    if (!templates.length) {
      return DEFAULT_EMAIL_TEMPLATES.map((t) => ({
        type: t.type,
        subject: t.subject,
        body: t.body,
        isActive: true,
      }));
    }

    return templates;
  }

  async findOne(tenantId: string, type: EmailTemplateType) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { tenantId_type: { tenantId, type: type as any } },
    });

    if (template) return template;

    const fallback = DEFAULT_EMAIL_TEMPLATES.find((t) => t.type === type);
    if (!fallback) throw new NotFoundException('Email template not found');

    return { ...fallback, isActive: true };
  }

  async update(
    tenantId: string,
    type: EmailTemplateType,
    data: { subject?: string; body?: string; isActive?: boolean },
  ) {
    const existing = await this.findOne(tenantId, type);
    return this.prisma.emailTemplate.upsert({
      where: { tenantId_type: { tenantId, type: type as any } },
      create: {
        tenantId,
        type: type as any,
        subject: data.subject ?? existing.subject,
        body: data.body ?? existing.body,
        isActive: data.isActive ?? true,
      },
      update: data,
    });
  }

  async render(
    tenantId: string,
    type: EmailTemplateType,
    variables: Record<string, string | number | undefined | null>,
  ) {
    const template = await this.findOne(tenantId, type);
    if (!template.isActive) {
      const fallback = DEFAULT_EMAIL_TEMPLATES.find((t) => t.type === type);
      if (!fallback) throw new NotFoundException('Email template inactive');
      return {
        subject: renderTemplate(fallback.subject, variables),
        body: renderTemplate(fallback.body, variables),
      };
    }

    return {
      subject: renderTemplate(template.subject, variables),
      body: renderTemplate(template.body, variables),
    };
  }
}
