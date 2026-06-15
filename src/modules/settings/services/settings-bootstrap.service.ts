import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_LATE_PAYMENT_TEXT,
  DEFAULT_NUMBERING_RULES,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_TAX_RATES,
} from '../constants/default-settings.constants';

@Injectable()
export class SettingsBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async seedTenantDefaults(tenantId: string) {
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        primaryCurrency: 'EUR',
        latePaymentPenaltyRate: 10,
        latePaymentPenaltyText: DEFAULT_LATE_PAYMENT_TEXT,
      },
      update: {},
    });

    await this.prisma.tenantCurrency.upsert({
      where: { tenantId_code: { tenantId, code: 'EUR' } },
      create: {
        tenantId,
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        manualRate: 1,
        isActive: true,
      },
      update: {},
    });

    for (const rule of DEFAULT_NUMBERING_RULES) {
      await this.prisma.documentNumberingRule.upsert({
        where: {
          tenantId_documentType: {
            tenantId,
            documentType: rule.documentType as any,
          },
        },
        create: {
          tenantId,
          documentType: rule.documentType as any,
          prefix: rule.prefix,
          draftMarker: rule.draftMarker,
          includeYear: rule.includeYear,
          counterLength: rule.counterLength,
          annualReset: rule.annualReset,
        },
        update: {},
      });
    }

    for (const tax of DEFAULT_TAX_RATES) {
      const existing = await this.prisma.taxRate.findFirst({
        where: { tenantId, rate: tax.rate },
      });
      if (!existing) {
        await this.prisma.taxRate.create({
          data: { tenantId, ...tax },
        });
      }
    }

    for (const term of DEFAULT_PAYMENT_TERMS) {
      const existing = await this.prisma.paymentTerm.findFirst({
        where: { tenantId, name: term.name },
      });
      if (!existing) {
        await this.prisma.paymentTerm.create({
          data: { tenantId, ...term },
        });
      }
    }

    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await this.prisma.emailTemplate.upsert({
        where: { tenantId_type: { tenantId, type: tpl.type as any } },
        create: { tenantId, type: tpl.type as any, subject: tpl.subject, body: tpl.body },
        update: {},
      });
    }

    await this.prisma.pdfTemplate.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    await this.prisma.reminderSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }
}
