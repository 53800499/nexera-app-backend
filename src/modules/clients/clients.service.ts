import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
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
      },
    },
  };

  async create(dto: CreateClientDto, tenantId: string) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.client.findFirst({
      where: { tenantId, code },
    });

    if (existing) {
      throw new BadRequestException(
        'Client code already exists in this tenant',
      );
    }

    const client = await this.prisma.client.create({
      data: {
        tenantId,
        code,
        clientType: dto.clientType as any,
        companyName: dto.companyName,
        tradeName: dto.tradeName,
        siret: dto.siret,
        taxId: dto.taxId,
        sector: dto.sector,
        billingAddress: dto.billingAddress
          ? JSON.parse(dto.billingAddress)
          : {},
        shippingAddress: dto.shippingAddress
          ? JSON.parse(dto.shippingAddress)
          : null,
        defaultCurrency: dto.defaultCurrency ?? 'EUR',
        defaultPaymentTermId: dto.defaultPaymentTermId,
        defaultDiscountPct: dto.defaultDiscountPct ?? 0,
        creditLimit: dto.creditLimit,
        notes: dto.notes,
        isArchived: dto.isArchived ?? false,
        createdBy: dto.createdBy ?? 'system',
      },
      include: this.clientInclude,
    });

    this.clientEventBus.publish(
      new ClientCreatedEvent(ClientEntity.fromPrisma(client)),
    );

    return client;
  }

  async findAll(tenantId: string, page = 1, limit = 20, q?: string) {
    const where: any = { tenantId, deletedAt: null };

    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { tradeName: { contains: q, mode: 'insensitive' } },
        { taxId: { contains: q, mode: 'insensitive' } },
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
      include: this.clientInclude,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, tenantId: string, dto: UpdateClientDto) {
    await this.findOne(id, tenantId);

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const existing = await this.prisma.client.findFirst({
        where: { tenantId, code, NOT: { id } },
      });

      if (existing) {
        throw new BadRequestException(
          'Client code already exists in this tenant',
        );
      }
      dto = { ...dto, code };
    }

    const data: any = { ...dto };

    if (dto.billingAddress) {
      data.billingAddress = JSON.parse(dto.billingAddress);
    }

    if (dto.shippingAddress) {
      data.shippingAddress = JSON.parse(dto.shippingAddress);
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      include: this.clientInclude,
    });

    this.clientEventBus.publish(
      new ClientUpdatedEvent(ClientEntity.fromPrisma(updated)),
    );

    return updated;
  }

  async remove(id: string, tenantId: string) {
    const client = await this.findOne(id, tenantId);

    const invoices = await this.prisma.invoice.findFirst({
      where: { tenantId, clientId: id },
    });

    if (invoices) {
      throw new BadRequestException('Cannot delete a client with invoices');
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

    return { message: 'Client archived successfully', clientId: client.id };
  }

  async createContact(
    clientId: string,
    tenantId: string,
    dto: CreateContactDto,
  ) {
    await this.findOne(clientId, tenantId);

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
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.contact.delete({ where: { id } });

    return { message: 'Contact deleted successfully', contactId: id };
  }
}
