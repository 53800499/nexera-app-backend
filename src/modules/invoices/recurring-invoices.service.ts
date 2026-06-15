import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvoicesService } from './invoices.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import { RecurringFrequency } from './enums/recurring-frequency.enum';
import { InvoiceType } from './enums/invoice-type.enum';
import { RecurringInvoiceNotificationService } from './services/recurring-invoice-notification.service';
import {
  computeNextExecution,
  isInGenerationWindow,
  sameCalendarDay,
  shouldAdvanceCycle,
} from './utils/recurring-schedule.util';

@Injectable()
export class RecurringInvoicesService {
  private readonly logger = new Logger(RecurringInvoicesService.name);

  private readonly recurringInclude = {
    invoice: {
      include: {
        client: true,
        contact: true,
        lines: true,
      },
    },
    generatedInvoices: {
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        totalTtc: true,
      },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly notificationService: RecurringInvoiceNotificationService,
  ) {}

  async create(
    invoiceId: string,
    tenantId: string,
    dto: CreateRecurringInvoiceDto,
  ) {
    const template = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: true },
    });

    if (!template) {
      throw new NotFoundException('Invoice template not found');
    }

    if (template.invoiceType === (InvoiceType.CREDIT_NOTE as string)) {
      throw new BadRequestException(
        'Credit notes cannot be used as recurring templates',
      );
    }

    if (!template.lines.length) {
      throw new BadRequestException('Template invoice must have lines');
    }

    const nextExecution = new Date(dto.nextExecution);
    if (Number.isNaN(nextExecution.getTime())) {
      throw new BadRequestException('Invalid nextExecution date');
    }

    const existing = await this.prisma.recurringInvoice.findFirst({
      where: { tenantId, invoiceId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException(
        'An active recurring schedule already exists for this invoice',
      );
    }

    return this.prisma.recurringInvoice.create({
      data: {
        tenantId,
        invoiceId,
        frequency: dto.frequency,
        nextExecution,
        isActive: dto.isActive ?? true,
      },
      include: this.recurringInclude,
    });
  }

  async findAll(tenantId: string, page = 1, limit = 50) {
    const where: Prisma.RecurringInvoiceWhereInput = { tenantId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recurringInvoice.findMany({
        where,
        include: this.recurringInclude,
        orderBy: { nextExecution: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recurringInvoice.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    const recurring = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      include: this.recurringInclude,
    });

    if (!recurring) {
      throw new NotFoundException('Recurring invoice schedule not found');
    }

    return recurring;
  }

  async update(id: string, tenantId: string, dto: UpdateRecurringInvoiceDto) {
    await this.findOne(id, tenantId);

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        frequency: dto.frequency,
        nextExecution: dto.nextExecution
          ? new Date(dto.nextExecution)
          : undefined,
        isActive: dto.isActive,
      },
      include: this.recurringInclude,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.recurringInvoice.delete({ where: { id } });
    return { message: 'Recurring schedule deleted', recurringId: id };
  }

  /** Déclenchement manuel (hors fenêtre J-7) */
  async generateNow(id: string, tenantId: string, createdBy: string) {
    const recurring = await this.findOne(id, tenantId);

    if (!recurring.isActive) {
      throw new BadRequestException('Recurring schedule is inactive');
    }

    const { draft } = await this.generateDraftForCycle(recurring, createdBy);
    return { recurring, draft };
  }

  /** Job quotidien — RM-F08 */
  async processAllDue(): Promise<{
    processed: number;
    generated: number;
    advanced: number;
  }> {
    const actives = await this.prisma.recurringInvoice.findMany({
      where: { isActive: true },
      include: {
        invoice: { include: { client: true, contact: true } },
      },
    });

    let generated = 0;
    let advanced = 0;

    for (const recurring of actives) {
      try {
        const result = await this.processOne(recurring, 'system');
        if (result.generated) generated += 1;
        if (result.advanced) advanced += 1;
      } catch (error) {
        this.logger.error(
          `Recurring ${recurring.id} failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { processed: actives.length, generated, advanced };
  }

  async processOne(
    recurring: {
      id: string;
      tenantId: string;
      invoiceId: string;
      frequency: string;
      nextExecution: Date;
      isActive: boolean;
      lastGeneratedForExecution: Date | null;
      invoice: {
        number: string;
        client: { companyName: string };
        contact: { email: string | null } | null;
      };
    },
    createdBy: string,
  ): Promise<{ generated: boolean; advanced: boolean }> {
    if (!recurring.isActive) {
      return { generated: false, advanced: false };
    }

    const now = new Date();
    let generated = false;
    let advanced = false;

    const alreadyGenerated =
      recurring.lastGeneratedForExecution &&
      sameCalendarDay(recurring.lastGeneratedForExecution, recurring.nextExecution);

    if (isInGenerationWindow(recurring.nextExecution, now) && !alreadyGenerated) {
      await this.generateDraftForCycle(recurring, createdBy);
      generated = true;
    }

    if (shouldAdvanceCycle(recurring.nextExecution, now)) {
      const next = computeNextExecution(
        recurring.frequency as RecurringFrequency,
        recurring.nextExecution,
      );
      await this.prisma.recurringInvoice.update({
        where: { id: recurring.id },
        data: { nextExecution: next },
      });
      advanced = true;
    }

    return { generated, advanced };
  }

  private async generateDraftForCycle(
    recurring: {
      id: string;
      tenantId: string;
      invoiceId: string;
      nextExecution: Date;
      invoice: {
        number: string;
        client: { companyName: string };
        contact: { email: string | null } | null;
      };
    },
    createdBy: string,
  ) {
    const draft = await this.invoicesService.cloneAsDraftFromTemplate(
      recurring.invoiceId,
      recurring.tenantId,
      {
        issueDate: recurring.nextExecution,
        recurringSourceId: recurring.id,
        createdBy,
      },
    );

    const recipient =
      recurring.invoice.contact?.email ??
      (await this.resolvePrimaryContactEmail(
        recurring.tenantId,
        draft.clientId,
      ));

    let notification: { sent: boolean; reason?: string } = {
      sent: false,
      reason: 'no_recipient',
    };
    if (recipient) {
      notification = await this.notificationService.notifyDraftReady({
        tenantId: recurring.tenantId,
        to: recipient,
        clientName: recurring.invoice.client.companyName,
        templateNumber: recurring.invoice.number,
        draftNumber: draft.number,
        draftId: draft.id,
        executionDate: recurring.nextExecution,
      });
    }

    await this.prisma.recurringInvoice.update({
      where: { id: recurring.id },
      data: {
        lastGeneratedInvoiceId: draft.id,
        lastGeneratedForExecution: recurring.nextExecution,
        lastNotifiedAt: new Date(),
      },
    });

    this.logger.log(
      `Recurring ${recurring.id}: draft ${draft.number} created (notify: ${notification.sent})`,
    );

    return { draft, notification };
  }

  private async resolvePrimaryContactEmail(
    tenantId: string,
    clientId: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { tenantId, clientId, email: { not: null } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return contact?.email?.trim() ?? undefined;
  }
}
