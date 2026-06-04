import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CheckClientDuplicateDto } from './dto/check-client-duplicate.dto';
import { ClientEventBus } from './events/client-event-bus';
import { ClientCreatedEvent } from './events/client-created.event';
import { ClientUpdatedEvent } from './events/client-updated.event';
import { ClientDeletedEvent } from './events/client-deleted.event';
import { ClientContactAddedEvent } from './events/client-contact-added.event';
import { ClientEntity } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private readonly clientEventBus: ClientEventBus,
  ) {}

  private clientInclude = {
    contacts: true,
    _count: {
      select: {
        contacts: true,
        quotations: true,
        invoices: true,
        orders: true,
        payments: true,
      },
    },
  };

  private clientDetailInclude = {
    contacts: { orderBy: { isPrimary: 'desc' as const } },
    quotations: {
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        totalTtc: true,
      },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
    invoices: {
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        totalTtc: true,
        amountDue: true,
      },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
    orders: {
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        totalTtc: true,
      },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
    payments: {
      select: {
        id: true,
        reference: true,
        paymentDate: true,
        amount: true,
        paymentMethod: true,
      },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
    _count: {
      select: {
        contacts: true,
        quotations: true,
        invoices: true,
        orders: true,
        payments: true,
      },
    },
  };

  async checkDuplicates(tenantId: string, dto: CheckClientDuplicateDto) {
    const duplicates = await this.findDuplicates(tenantId, dto);
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
    };
  }

  async create(
    dto: CreateClientDto,
    tenantId: string,
    createdBy: string,
  ) {
    this.parseAddress(dto.billingAddress, 'billingAddress');
    if (dto.shippingAddress) {
      this.parseAddress(dto.shippingAddress, 'shippingAddress');
    }

    const duplicates = await this.findDuplicates(tenantId, {
      siret: dto.siret,
      taxId: dto.taxId,
      email: dto.primaryContact.email,
      companyName: dto.companyName,
    });

    if (duplicates.length > 0 && !dto.confirmDuplicate) {
      throw new ConflictException({
        code: 'DUPLICATE_CLIENT',
        message:
          'Un client similaire existe déjà (SIRET, IFU ou email). Confirmez avec confirmDuplicate: true pour créer malgré tout.',
        duplicates,
      });
    }

    const code = await this.generateClientCode(tenantId);

    const client = await this.prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          tenantId,
          code,
          clientType: dto.clientType as any,
          companyName: dto.companyName,
          tradeName: dto.tradeName,
          siret: dto.siret,
          taxId: dto.taxId,
          sector: dto.sector,
          billingAddress: JSON.parse(dto.billingAddress),
          shippingAddress: dto.shippingAddress
            ? JSON.parse(dto.shippingAddress)
            : null,
          defaultCurrency: dto.defaultCurrency ?? 'EUR',
          defaultPaymentTermId: dto.defaultPaymentTermId,
          defaultDiscountPct: dto.defaultDiscountPct ?? 0,
          creditLimit: dto.creditLimit,
          notes: dto.notes,
          isArchived: false,
          createdBy,
          contacts: {
            create: {
              tenantId,
              firstName: dto.primaryContact.firstName,
              lastName: dto.primaryContact.lastName,
              jobTitle: dto.primaryContact.jobTitle,
              email: dto.primaryContact.email,
              phone: dto.primaryContact.phone,
              isPrimary: dto.primaryContact.isPrimary ?? true,
            },
          },
        },
        include: this.clientDetailInclude,
      });

      return created;
    });

    this.clientEventBus.publish(
      new ClientCreatedEvent(ClientEntity.fromPrisma(client)),
    );

    return {
      ...client,
      duplicateWarning:
        duplicates.length > 0
          ? { acknowledged: true, matches: duplicates }
          : undefined,
    };
  }

  async findAll(tenantId: string, page = 1, limit = 20, q?: string) {
    const where: Prisma.ClientWhereInput = { tenantId, deletedAt: null };

    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { tradeName: { contains: q, mode: 'insensitive' } },
        { taxId: { contains: q, mode: 'insensitive' } },
        { siret: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: this.clientInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async search(tenantId: string, query: string) {
    return this.findAll(tenantId, 1, 20, query);
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: this.clientDetailInclude,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return {
      ...client,
      history: {
        quotations: client.quotations,
        invoices: client.invoices,
        orders: client.orders,
        payments: client.payments,
        counts: client._count,
      },
    };
  }

  async update(id: string, tenantId: string, dto: UpdateClientDto) {
    await this.findOne(id, tenantId);

    if ((dto as { code?: string }).code !== undefined) {
      throw new BadRequestException(
        'Client code cannot be modified (RM-C01)',
      );
    }

    const {
      billingAddress,
      shippingAddress,
      ...scalarFields
    } = dto;

    const data: Prisma.ClientUpdateInput = {
      ...scalarFields,
      clientType: scalarFields.clientType as any,
    };

    if (billingAddress) {
      data.billingAddress = this.parseAddress(
        billingAddress,
        'billingAddress',
      );
    }

    if (shippingAddress !== undefined) {
      data.shippingAddress = shippingAddress
        ? this.parseAddress(shippingAddress, 'shippingAddress')
        : Prisma.JsonNull;
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      include: this.clientDetailInclude,
    });

    this.clientEventBus.publish(
      new ClientUpdatedEvent(ClientEntity.fromPrisma(updated)),
    );

    return updated;
  }

  /** Archivage (RM-C05) — jamais de suppression physique si transactions existent */
  async remove(id: string, tenantId: string) {
    const client = await this.findOne(id, tenantId);

    const hasTransactions = await this.clientHasTransactions(
      tenantId,
      id,
    );

    if (hasTransactions) {
      await this.prisma.client.update({
        where: { id },
        data: { isArchived: true },
      });

      return {
        message: 'Client archived successfully (has transactions)',
        clientId: client.id,
        archived: true,
        deleted: false,
      };
    }

    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isArchived: true },
    });

    this.clientEventBus.publish(
      new ClientDeletedEvent(
        ClientEntity.fromPrisma({
          ...client,
          deletedAt: new Date(),
          isArchived: true,
        }),
      ),
    );

    return {
      message: 'Client archived successfully',
      clientId: client.id,
      archived: true,
    };
  }

  async createContact(
    clientId: string,
    tenantId: string,
    dto: CreateContactDto,
  ) {
    await this.findOne(clientId, tenantId);

    if (dto.email) {
      const dup = await this.findDuplicates(tenantId, { email: dto.email });
      if (dup.length > 0) {
        throw new ConflictException({
          code: 'DUPLICATE_EMAIL',
          message: 'A contact with this email already exists',
          duplicates: dup,
        });
      }
    }

    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        clientId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        jobTitle: dto.jobTitle,
        email: dto.email,
        phone: dto.phone,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    this.clientEventBus.publish(
      new ClientContactAddedEvent(
        ClientEntity.fromPrisma(await this.findOne(clientId, tenantId)),
        contact.id,
      ),
    );

    return contact;
  }

  async updateContact(id: string, tenantId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.prisma.contact.update({
      where: { id },
      data: dto,
    });
  }

  async removeContact(id: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: { client: { include: { _count: { select: { contacts: true } } } } },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (contact.client._count.contacts <= 1) {
      throw new BadRequestException(
        'Cannot remove the last contact (RM-C02)',
      );
    }

    await this.prisma.contact.delete({ where: { id } });

    return { message: 'Contact deleted successfully', contactId: id };
  }

  private async findDuplicates(
    tenantId: string,
    criteria: CheckClientDuplicateDto,
  ) {
    const or: Prisma.ClientWhereInput[] = [];

    if (criteria.siret?.trim()) {
      or.push({ siret: criteria.siret.trim() });
    }
    if (criteria.taxId?.trim()) {
      or.push({ taxId: criteria.taxId.trim() });
    }
    if (criteria.companyName?.trim()) {
      or.push({
        companyName: {
          equals: criteria.companyName.trim(),
          mode: 'insensitive',
        },
      });
    }

    const clients =
      or.length > 0
        ? await this.prisma.client.findMany({
            where: { tenantId, deletedAt: null, OR: or },
            select: {
              id: true,
              code: true,
              companyName: true,
              siret: true,
              taxId: true,
            },
          })
        : [];

    const emailMatches =
      criteria.email?.trim()
        ? await this.prisma.contact.findMany({
            where: {
              tenantId,
              email: { equals: criteria.email.trim(), mode: 'insensitive' },
              client: { deletedAt: null },
            },
            select: {
              id: true,
              email: true,
              client: {
                select: {
                  id: true,
                  code: true,
                  companyName: true,
                  siret: true,
                  taxId: true,
                },
              },
            },
          })
        : [];

    const byClientId = new Map<
      string,
      {
        id: string;
        code: string;
        companyName: string;
        siret: string | null;
        taxId: string | null;
        matchedOn: string[];
      }
    >();

    for (const client of clients) {
      const matchedOn: string[] = [];
      if (criteria.siret && client.siret === criteria.siret.trim()) {
        matchedOn.push('siret');
      }
      if (criteria.taxId && client.taxId === criteria.taxId.trim()) {
        matchedOn.push('taxId');
      }
      if (
        criteria.companyName &&
        client.companyName.toLowerCase() ===
          criteria.companyName.trim().toLowerCase()
      ) {
        matchedOn.push('companyName');
      }
      byClientId.set(client.id, { ...client, matchedOn });
    }

    for (const row of emailMatches) {
      const existing = byClientId.get(row.client.id);
      if (existing) {
        if (!existing.matchedOn.includes('email')) {
          existing.matchedOn.push('email');
        }
        continue;
      }
      byClientId.set(row.client.id, {
        ...row.client,
        matchedOn: ['email'],
      });
    }

    return Array.from(byClientId.values());
  }

  private async clientHasTransactions(tenantId: string, clientId: string) {
    const [quotation, order, invoice, payment] = await Promise.all([
      this.prisma.quotation.findFirst({ where: { tenantId, clientId } }),
      this.prisma.order.findFirst({ where: { tenantId, clientId } }),
      this.prisma.invoice.findFirst({ where: { tenantId, clientId } }),
      this.prisma.payment.findFirst({ where: { tenantId, clientId } }),
    ]);

    return !!(quotation || order || invoice || payment);
  }

  private parseAddress(raw: string, field: string): Prisma.InputJsonValue {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || Object.keys(parsed).length === 0) {
        throw new Error('empty');
      }
      return parsed as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException(
        `${field} must be a non-empty JSON object`,
      );
    }
  }

  private async generateClientCode(tenantId: string) {
    const pattern = 'CLT-';
    const latest = await this.prisma.client.findFirst({
      where: { tenantId, code: { startsWith: pattern } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let seq = 1;
    if (latest?.code) {
      const parsed = Number.parseInt(latest.code.replace(pattern, ''), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${pattern}${String(seq + attempt).padStart(6, '0')}`;
      const exists = await this.prisma.client.findFirst({
        where: { tenantId, code: candidate },
      });
      if (!exists) return candidate;
    }

    throw new BadRequestException('Unable to generate a unique client code');
  }
}
