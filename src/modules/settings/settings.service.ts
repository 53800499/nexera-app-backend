import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CreatePaymentTermDto,
  CreateTaxRateDto,
  CreateTenantCurrencyDto,
  EmailTemplateType,
  NumberingDocumentType,
  UpdateEmailTemplateDto,
  UpdateNumberingRuleDto,
  UpdatePaymentTermDto,
  UpdatePdfTemplateDto,
  UpdateTaxRateDto,
  UpdateTenantCurrencyDto,
  UpdateTenantSettingsDto,
} from './dto/settings.dto';
import { DocumentNumberingService } from './services/document-numbering.service';
import { EmailTemplateService } from './services/email-template.service';
import { UpdateReminderSettingsDto } from '../reminders/dto/update-reminder-settings.dto';
import { renderTemplate } from './utils/template-render.util';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  async getOverview(tenantId: string) {
    const [tenant, taxRates, paymentTerms, currencies, numbering, emailTemplates, pdf, reminders] =
      await Promise.all([
        this.getTenantSettings(tenantId),
        this.listTaxRates(tenantId),
        this.listPaymentTerms(tenantId),
        this.listCurrencies(tenantId),
        this.numberingService.listRules(tenantId),
        this.emailTemplateService.findAll(tenantId),
        this.getPdfTemplate(tenantId),
        this.getReminderSettings(tenantId),
      ]);

    return {
      tenant,
      taxRates,
      paymentTerms,
      currencies,
      numbering,
      emailTemplates,
      pdf,
      reminders,
    };
  }

  async getTenantSettings(tenantId: string) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateTenantSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async getLatePaymentMention(tenantId: string): Promise<string | null> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings.latePaymentPenaltyText) return null;
    return renderTemplate(settings.latePaymentPenaltyText, {
      penaltyRate: settings.latePaymentPenaltyRate,
    });
  }

  async listTaxRates(tenantId: string) {
    return this.prisma.taxRate.findMany({
      where: { tenantId },
      orderBy: { rate: 'asc' },
    });
  }

  async createTaxRate(tenantId: string, dto: CreateTaxRateDto) {
    if (dto.isDefault) {
      await this.prisma.taxRate.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.taxRate.create({ data: { tenantId, ...dto } });
  }

  async updateTaxRate(tenantId: string, id: string, dto: UpdateTaxRateDto) {
    await this.assertTaxRate(tenantId, id);
    if (dto.isDefault) {
      await this.prisma.taxRate.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.taxRate.update({ where: { id }, data: dto });
  }

  async deleteTaxRate(tenantId: string, id: string) {
    await this.assertTaxRate(tenantId, id);
    const usage = await this.prisma.invoiceLine.count({
      where: { taxRateId: id, tenantId },
    });
    if (usage > 0) {
      throw new BadRequestException('Tax rate is in use');
    }
    await this.prisma.taxRate.delete({ where: { id } });
    return { message: 'Tax rate deleted', id };
  }

  async listPaymentTerms(tenantId: string) {
    return this.prisma.paymentTerm.findMany({
      where: { tenantId },
      orderBy: { days: 'asc' },
    });
  }

  async createPaymentTerm(tenantId: string, dto: CreatePaymentTermDto) {
    if (dto.isDefault) {
      await this.prisma.paymentTerm.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.paymentTerm.create({ data: { tenantId, ...dto } });
  }

  async updatePaymentTerm(
    tenantId: string,
    id: string,
    dto: UpdatePaymentTermDto,
  ) {
    await this.assertPaymentTerm(tenantId, id);
    if (dto.isDefault) {
      await this.prisma.paymentTerm.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.paymentTerm.update({ where: { id }, data: dto });
  }

  async deletePaymentTerm(tenantId: string, id: string) {
    await this.assertPaymentTerm(tenantId, id);
    const usage = await this.prisma.invoice.count({
      where: { paymentTermId: id, tenantId },
    });
    if (usage > 0) {
      throw new BadRequestException('Payment term is in use');
    }
    await this.prisma.paymentTerm.delete({ where: { id } });
    return { message: 'Payment term deleted', id };
  }

  async getDefaultPaymentTerm(tenantId: string) {
    return this.prisma.paymentTerm.findFirst({
      where: { tenantId, isDefault: true },
    });
  }

  async listCurrencies(tenantId: string) {
    return this.prisma.tenantCurrency.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createCurrency(tenantId: string, dto: CreateTenantCurrencyDto) {
    const settings = await this.getTenantSettings(tenantId);
    if (dto.code === settings.primaryCurrency) {
      throw new BadRequestException('Use primary currency settings for base currency');
    }
    return this.prisma.tenantCurrency.create({
      data: { tenantId, ...dto, isActive: true },
    });
  }

  async updateCurrency(
    tenantId: string,
    id: string,
    dto: UpdateTenantCurrencyDto,
  ) {
    const currency = await this.prisma.tenantCurrency.findFirst({
      where: { id, tenantId },
    });
    if (!currency) throw new NotFoundException('Currency not found');
    return this.prisma.tenantCurrency.update({ where: { id }, data: dto });
  }

  async deleteCurrency(tenantId: string, id: string) {
    const currency = await this.prisma.tenantCurrency.findFirst({
      where: { id, tenantId },
    });
    if (!currency) throw new NotFoundException('Currency not found');
    await this.prisma.tenantCurrency.delete({ where: { id } });
    return { message: 'Currency deleted', id };
  }

  async listNumberingRules(tenantId: string) {
    return this.numberingService.listRules(tenantId);
  }

  async updateNumberingRule(
    tenantId: string,
    documentType: NumberingDocumentType,
    dto: UpdateNumberingRuleDto,
  ) {
    return this.numberingService.updateRule(tenantId, documentType, dto);
  }

  async listEmailTemplates(tenantId: string) {
    return this.emailTemplateService.findAll(tenantId);
  }

  async getEmailTemplate(tenantId: string, type: EmailTemplateType) {
    return this.emailTemplateService.findOne(tenantId, type);
  }

  async updateEmailTemplate(
    tenantId: string,
    type: EmailTemplateType,
    dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplateService.update(tenantId, type, dto);
  }

  async getPdfTemplate(tenantId: string) {
    return this.prisma.pdfTemplate.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updatePdfTemplate(tenantId: string, dto: UpdatePdfTemplateDto) {
    return this.prisma.pdfTemplate.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async getReminderSettings(tenantId: string) {
    const settings = await this.prisma.reminderSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    return {
      isEnabled: settings.isEnabled,
      level1DaysAfterDue: settings.level1DaysAfterDue,
      level2DaysAfterDue: settings.level2DaysAfterDue,
      level3DaysAfterDue: settings.level3DaysAfterDue,
      level2CopyCommercial: settings.level2CopyCommercial,
      level3AlertDirector: settings.level3AlertDirector,
      level3BlockNewOrders: settings.level3BlockNewOrders,
      commercialEmail: settings.commercialEmail,
      directorEmail: settings.directorEmail,
    };
  }

  async updateReminderSettings(
    tenantId: string,
    dto: UpdateReminderSettingsDto,
  ) {
    if (
      dto.level1DaysAfterDue !== undefined &&
      dto.level2DaysAfterDue !== undefined &&
      dto.level1DaysAfterDue >= dto.level2DaysAfterDue
    ) {
      throw new BadRequestException('level1 must be before level2');
    }
    if (
      dto.level2DaysAfterDue !== undefined &&
      dto.level3DaysAfterDue !== undefined &&
      dto.level2DaysAfterDue >= dto.level3DaysAfterDue
    ) {
      throw new BadRequestException('level2 must be before level3');
    }

    await this.prisma.reminderSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });

    return this.getReminderSettings(tenantId);
  }

  private async assertTaxRate(tenantId: string, id: string) {
    const rate = await this.prisma.taxRate.findFirst({ where: { id, tenantId } });
    if (!rate) throw new NotFoundException('Tax rate not found');
  }

  private async assertPaymentTerm(tenantId: string, id: string) {
    const term = await this.prisma.paymentTerm.findFirst({
      where: { id, tenantId },
    });
    if (!term) throw new NotFoundException('Payment term not found');
  }
}
