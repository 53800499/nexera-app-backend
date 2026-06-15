import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReminderSettings } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DEFAULT_PAGE_SIZE } from '../../shared/utils/pagination.util';
import { InvoiceStatus } from '../invoices/enums/invoice-status.enum';
import { InvoiceType } from '../invoices/enums/invoice-type.enum';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';
import { SendManualReminderDto } from './dto/send-manual-reminder.dto';
import { ReminderType } from './enums/reminder-type.enum';
import { ReminderChannel } from './enums/reminder-channel.enum';
import { ReminderLevel } from './enums/reminder-level.enum';
import { ReminderEntity } from './entities/reminder.entity';
import { ReminderEventBus } from './events/reminder-event-bus';
import { ReminderSentEvent } from './events/reminder-sent.event';
import { ReminderNotificationService } from './services/reminder-notification.service';
import {
  daysPastDue,
  resolveNextReminderLevel,
} from './utils/reminder-eligibility.util';

type OverdueInvoice = {
  id: string;
  tenantId: string;
  number: string;
  clientId: string;
  dueDate: Date | null;
  amountDue: number;
  currency: string;
  status: string;
  invoiceType: string;
  client: {
    companyName: string;
    remindersDisabled: boolean;
    contacts: Array<{ email: string | null; isPrimary: boolean }>;
  };
};

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: ReminderNotificationService,
    private readonly reminderEventBus: ReminderEventBus,
  ) {}

  private readonly reminderInclude = {
    invoice: { select: { id: true, number: true } },
    client: { select: { id: true, companyName: true } },
  };

  async getSettings(tenantId: string) {
    const settings = await this.ensureSettings(tenantId);
    return this.toSettingsResponse(settings);
  }

  async updateSettings(tenantId: string, dto: UpdateReminderSettingsDto) {
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

    const settings = await this.prisma.reminderSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });

    return this.toSettingsResponse(settings);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    clientId?: string,
    invoiceId?: string,
  ) {
    const where: Prisma.ReminderWhereInput = {
      tenantId,
      ...(clientId ? { clientId } : {}),
      ...(invoiceId ? { invoiceId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        include: this.reminderInclude,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toReminderResponse(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findByInvoice(invoiceId: string, tenantId: string) {
    await this.assertInvoice(invoiceId, tenantId);
    const items = await this.prisma.reminder.findMany({
      where: { tenantId, invoiceId },
      include: this.reminderInclude,
      orderBy: { sentAt: 'desc' },
    });
    return items.map((r) => this.toReminderResponse(r));
  }

  async findByClient(clientId: string, tenantId: string) {
    await this.assertClient(clientId, tenantId);
    const items = await this.prisma.reminder.findMany({
      where: { tenantId, clientId },
      include: this.reminderInclude,
      orderBy: { sentAt: 'desc' },
    });
    return items.map((r) => this.toReminderResponse(r));
  }

  async sendManual(
    invoiceId: string,
    tenantId: string,
    dto: SendManualReminderDto,
    createdBy: string,
  ) {
    const invoice = await this.getOverdueInvoiceOrThrow(invoiceId, tenantId);

    if (invoice.client.remindersDisabled) {
      throw new BadRequestException(
        'Reminders are disabled for this client',
      );
    }

    const emailTo = this.resolveClientEmail(invoice.client.contacts);
    if (!emailTo && (dto.channel ?? ReminderChannel.EMAIL) === ReminderChannel.EMAIL) {
      throw new BadRequestException('No email contact found for client');
    }

    const level = dto.level ?? ReminderLevel.LEVEL_1;
    const subject =
      dto.subject ?? `Relance manuelle — facture ${invoice.number}`;

    const cc: string[] = [];
    const settings = await this.ensureSettings(tenantId);

    if (dto.channel === ReminderChannel.EMAIL || !dto.channel) {
      await this.notificationService.sendEmail({
        to: emailTo!,
        cc,
        subject,
        body: dto.message,
        level: level as ReminderLevel,
        invoiceNumber: invoice.number,
        clientName: invoice.client.companyName,
      });
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId,
        invoiceId,
        clientId: invoice.clientId,
        level,
        type: ReminderType.MANUAL,
        channel: (dto.channel ?? ReminderChannel.EMAIL) as any,
        subject,
        sentAt: new Date(),
        emailTo,
        bodySnapshot: dto.message,
        createdBy,
      },
      include: this.reminderInclude,
    });

    this.publishSent(reminder, invoice.number, invoice.client.companyName);
    return this.toReminderResponse(reminder);
  }

  async processAutomaticReminders(tenantId?: string) {
    const tenants = tenantId
      ? [{ id: tenantId }]
      : await this.prisma.tenant.findMany({ select: { id: true } });

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let blocked = 0;

    for (const tenant of tenants) {
      const settings = await this.ensureSettings(tenant.id);
      if (!settings.isEnabled) continue;

      await this.syncOverdueStatuses(tenant.id);
      const invoices = await this.findOverdueInvoices(tenant.id);

      for (const invoice of invoices) {
        processed += 1;

        if (invoice.client.remindersDisabled) {
          skipped += 1;
          continue;
        }

        if (!invoice.dueDate) {
          skipped += 1;
          continue;
        }

        const overdueDays = daysPastDue(invoice.dueDate);
        const existing = await this.prisma.reminder.findMany({
          where: { tenantId: tenant.id, invoiceId: invoice.id, type: ReminderType.AUTO },
          select: { level: true },
        });
        const sentLevels = existing.map((r) => r.level);

        const nextLevel = resolveNextReminderLevel(overdueDays, settings, sentLevels);
        if (!nextLevel) {
          skipped += 1;
          continue;
        }

        const emailTo = this.resolveClientEmail(invoice.client.contacts);
        if (!emailTo) {
          skipped += 1;
          continue;
        }

        const openInvoices =
          nextLevel >= ReminderLevel.LEVEL_2
            ? await this.getClientOpenInvoices(tenant.id, invoice.clientId)
            : undefined;

        const openInvoicesRecap = openInvoices
          ?.map(
            (inv) =>
              `- ${inv.number} : ${inv.amountDue.toFixed(2)} ${invoice.currency}` +
              (inv.dueDate
                ? ` (éch. ${inv.dueDate.toLocaleDateString('fr-FR')})`
                : ''),
          )
          .join('\n');

        const mailContent = await this.notificationService.buildAutoEmail(
          tenant.id,
          nextLevel,
          {
            clientName: invoice.client.companyName,
            invoiceNumber: invoice.number,
            amountDue: invoice.amountDue.toFixed(2),
            currency: invoice.currency,
            dueDate: invoice.dueDate.toLocaleDateString('fr-FR'),
            openInvoicesRecap,
          },
        );
        const subject = mailContent.subject;
        const body = mailContent.body;

        const cc = this.resolveCcEmails(settings, nextLevel);

        await this.notificationService.sendEmail({
          to: emailTo,
          cc,
          subject,
          body,
          level: nextLevel,
          invoiceNumber: invoice.number,
          clientName: invoice.client.companyName,
        });

        const reminder = await this.prisma.reminder.create({
          data: {
            tenantId: tenant.id,
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            level: nextLevel,
            type: ReminderType.AUTO,
            channel: ReminderChannel.EMAIL,
            subject,
            sentAt: new Date(),
            emailTo,
            ccEmails: cc.length ? cc.join(',') : null,
            bodySnapshot: body,
          },
          include: this.reminderInclude,
        });

        if (
          nextLevel === ReminderLevel.LEVEL_3 &&
          settings.level3BlockNewOrders
        ) {
          await this.prisma.client.update({
            where: { id: invoice.clientId },
            data: { blockedForNewOrders: true },
          });
          blocked += 1;
        }

        this.publishSent(reminder, invoice.number, invoice.client.companyName);
        sent += 1;
      }
    }

    return { processed, sent, skipped, blocked };
  }

  async syncClientBlockStatus(clientId: string, tenantId: string) {
    const openOverdue = await this.prisma.invoice.count({
      where: {
        tenantId,
        clientId,
        amountDue: { gt: 0.01 },
        dueDate: { lt: new Date() },
        status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.PARTIAL, InvoiceStatus.SENT, InvoiceStatus.ISSUED] },
        invoiceType: { not: InvoiceType.PROFORMA },
      },
    });

    await this.prisma.client.update({
      where: { id: clientId },
      data: { blockedForNewOrders: openOverdue > 0 },
    });
  }

  async assertClientNotBlocked(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });

    if (!client) {
      throw new BadRequestException('Client not found for this tenant');
    }

    if (client.blockedForNewOrders) {
      throw new BadRequestException(
        'Client blocked for new quotations/orders due to overdue invoices (mise en demeure)',
      );
    }
  }

  private async ensureSettings(tenantId: string): Promise<ReminderSettings> {
    return this.prisma.reminderSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  private async syncOverdueStatuses(tenantId: string) {
    await this.prisma.invoice.updateMany({
      where: {
        tenantId,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PARTIAL],
        },
        dueDate: { lt: new Date() },
        amountDue: { gt: 0 },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }

  private async findOverdueInvoices(tenantId: string): Promise<OverdueInvoice[]> {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        invoiceType: { not: InvoiceType.PROFORMA },
        amountDue: { gt: 0.01 },
        dueDate: { lt: new Date() },
        status: {
          in: [
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.SENT,
            InvoiceStatus.ISSUED,
          ],
        },
      },
      include: {
        client: {
          select: {
            companyName: true,
            remindersDisabled: true,
            contacts: {
              select: { email: true, isPrimary: true },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
      },
    }) as Promise<OverdueInvoice[]>;
  }

  private async getClientOpenInvoices(tenantId: string, clientId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        clientId,
        amountDue: { gt: 0.01 },
        invoiceType: { not: InvoiceType.PROFORMA },
        status: {
          in: [
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.SENT,
            InvoiceStatus.ISSUED,
          ],
        },
      },
      select: { number: true, amountDue: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    });

    return invoices.map((inv) => ({
      number: inv.number,
      amountDue: inv.amountDue,
      dueDate: inv.dueDate,
    }));
  }

  private resolveCcEmails(
    settings: ReminderSettings,
    level: ReminderLevel,
  ): string[] {
    const cc: string[] = [];
    if (
      level === ReminderLevel.LEVEL_2 &&
      settings.level2CopyCommercial &&
      settings.commercialEmail
    ) {
      cc.push(settings.commercialEmail);
    }
    if (
      level === ReminderLevel.LEVEL_3 &&
      settings.level3AlertDirector &&
      settings.directorEmail
    ) {
      cc.push(settings.directorEmail);
    }
    return cc;
  }

  private resolveClientEmail(
    contacts: Array<{ email: string | null; isPrimary: boolean }>,
  ): string | null {
    const primary = contacts.find((c) => c.isPrimary && c.email?.trim());
    if (primary?.email) return primary.email.trim();
    const any = contacts.find((c) => c.email?.trim());
    return any?.email?.trim() ?? null;
  }

  private async getOverdueInvoiceOrThrow(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        client: {
          select: {
            companyName: true,
            remindersDisabled: true,
            contacts: {
              select: { email: true, isPrimary: true },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.invoiceType === InvoiceType.PROFORMA) {
      throw new BadRequestException('Proforma invoices are not remindable');
    }
    if (invoice.amountDue <= 0.01) {
      throw new BadRequestException('Invoice has no amount due');
    }

    return invoice as OverdueInvoice;
  }

  private async assertInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
  }

  private async assertClient(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
  }

  private publishSent(
    reminder: { id: string; tenantId: string; invoiceId: string; clientId: string; level: number; type: string; channel: string },
    invoiceNumber: string,
    clientName: string,
  ) {
    const entity = ReminderEntity.fromPrisma(reminder);
    this.reminderEventBus.publish(
      new ReminderSentEvent(entity, invoiceNumber, clientName),
    );
  }

  private toSettingsResponse(settings: ReminderSettings) {
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

  private toReminderResponse(reminder: any) {
    return {
      id: reminder.id,
      invoiceId: reminder.invoiceId,
      invoiceNumber: reminder.invoice?.number,
      clientId: reminder.clientId,
      clientName: reminder.client?.companyName,
      level: reminder.level,
      type: reminder.type,
      channel: reminder.channel,
      subject: reminder.subject,
      sentAt: reminder.sentAt,
      emailTo: reminder.emailTo,
      ccEmails: reminder.ccEmails,
      bodySnapshot: reminder.bodySnapshot,
      createdAt: reminder.createdAt,
    };
  }
}
