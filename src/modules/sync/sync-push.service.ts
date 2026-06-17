import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SyncMutationStatus as PrismaSyncMutationStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { CreateContactDto } from '../clients/dto/create-contact.dto';
import { UpdateContactDto } from '../clients/dto/update-contact.dto';
import { QuotationsService } from '../quotations/quotations.service';
import { CreateQuotationDto } from '../quotations/dto/create-quotation.dto';
import { UpdateQuotationDto } from '../quotations/dto/update-quotation.dto';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { UpdateOrderDto } from '../orders/dto/update-order.dto';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../invoices/dto/update-invoice.dto';
import { InvoiceStatus } from '../invoices/enums/invoice-status.enum';
import { PaymentsService } from '../payments/payments.service';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { RecordPaymentDto } from '../invoices/dto/record-payment.dto';
import { CatalogueService } from '../catalogue/catalogue.service';
import { CreateCatalogCategoryDto } from '../catalogue/dto/create-catalog-category.dto';
import { UpdateCatalogCategoryDto } from '../catalogue/dto/update-catalog-category.dto';
import { CreateCatalogItemDto } from '../catalogue/dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from '../catalogue/dto/update-catalog-item.dto';
import { SyncMutationDto, SyncPushDto } from './dto/sync.dto';
import { SyncEntityType } from './enums/sync-entity-type.enum';
import { SyncMutationStatus } from './enums/sync-mutation-status.enum';
import { SyncOperation } from './enums/sync-operation.enum';

export interface SyncMutationResult {
  mutationId: string;
  status: SyncMutationStatus;
  entityType: SyncEntityType;
  entityId?: string;
  localId?: string;
  serverVersion?: string;
  errorCode?: string;
  message?: string;
  serverEntity?: unknown;
}

@Injectable()
export class SyncPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly quotationsService: QuotationsService,
    private readonly ordersService: OrdersService,
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly catalogueService: CatalogueService,
  ) {}

  async push(
    tenantId: string,
    userId: string,
    dto: SyncPushDto,
  ): Promise<{ batchId: string; results: SyncMutationResult[] }> {
    await this.prisma.syncDevice.upsert({
      where: {
        tenantId_userId_deviceId: {
          tenantId,
          userId,
          deviceId: dto.deviceId,
        },
      },
      create: {
        tenantId,
        userId,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        lastPushAt: new Date(),
      },
      update: {
        deviceName: dto.deviceName,
        lastPushAt: new Date(),
      },
    });

    const results: SyncMutationResult[] = [];

    for (const mutation of dto.mutations) {
      results.push(
        await this.applyMutation(tenantId, userId, dto.deviceId, dto.batchId, mutation),
      );
    }

    return { batchId: dto.batchId, results };
  }

  private async applyMutation(
    tenantId: string,
    userId: string,
    deviceId: string,
    batchId: string,
    mutation: SyncMutationDto,
  ): Promise<SyncMutationResult> {
    const existing = await this.prisma.syncMutationLog.findUnique({
      where: {
        tenantId_deviceId_mutationId: {
          tenantId,
          deviceId,
          mutationId: mutation.mutationId,
        },
      },
    });

    if (existing) {
      return {
        mutationId: mutation.mutationId,
        status: SyncMutationStatus.DUPLICATE,
        entityType: mutation.entityType,
        entityId: existing.entityId ?? undefined,
        errorCode: 'DUPLICATE_MUTATION',
        message: 'Mutation already processed',
      };
    }

    try {
      const outcome = await this.dispatch(tenantId, userId, mutation);
      await this.logMutation({
        tenantId,
        userId,
        deviceId,
        batchId,
        mutation,
        status: PrismaSyncMutationStatus.applied,
        entityId: outcome.entityId,
      });

      return {
        mutationId: mutation.mutationId,
        status: SyncMutationStatus.APPLIED,
        entityType: mutation.entityType,
        entityId: outcome.entityId,
        localId: mutation.localId,
        serverVersion: outcome.serverVersion,
        serverEntity: outcome.serverEntity,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        const response = error.getResponse() as {
          serverEntity?: unknown;
          serverVersion?: string;
        };

        await this.logMutation({
          tenantId,
          userId,
          deviceId,
          batchId,
          mutation,
          status: PrismaSyncMutationStatus.conflict,
          entityId: mutation.entityId,
          errorCode: 'VERSION_CONFLICT',
        });

        return {
          mutationId: mutation.mutationId,
          status: SyncMutationStatus.CONFLICT,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          localId: mutation.localId,
          errorCode: 'VERSION_CONFLICT',
          message: error.message,
          serverVersion: response?.serverVersion,
          serverEntity: response?.serverEntity,
        };
      }

      const errorCode =
        error instanceof BadRequestException
          ? 'VALIDATION_ERROR'
          : error instanceof NotFoundException
            ? 'NOT_FOUND'
            : 'REJECTED';

      await this.logMutation({
        tenantId,
        userId,
        deviceId,
        batchId,
        mutation,
        status: PrismaSyncMutationStatus.rejected,
        entityId: mutation.entityId,
        errorCode,
      });

      return {
        mutationId: mutation.mutationId,
        status: SyncMutationStatus.REJECTED,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.localId,
        errorCode,
        message: error instanceof Error ? error.message : 'Rejected',
      };
    }
  }

  private async dispatch(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ): Promise<{
    entityId: string;
    serverVersion?: string;
    serverEntity?: unknown;
  }> {
    switch (mutation.entityType) {
      case SyncEntityType.CLIENT:
        return this.pushClient(tenantId, userId, mutation);
      case SyncEntityType.CONTACT:
        return this.pushContact(tenantId, mutation);
      case SyncEntityType.QUOTATION:
        return this.pushQuotation(tenantId, userId, mutation);
      case SyncEntityType.ORDER:
        return this.pushOrder(tenantId, userId, mutation);
      case SyncEntityType.INVOICE:
        return this.pushInvoice(tenantId, userId, mutation);
      case SyncEntityType.PAYMENT:
        return this.pushPayment(tenantId, userId, mutation);
      case SyncEntityType.CATALOG_CATEGORY:
        return this.pushCatalogCategory(tenantId, mutation);
      case SyncEntityType.CATALOG_ITEM:
        return this.pushCatalogItem(tenantId, mutation);
      default:
        throw new BadRequestException(
          `Entity type ${mutation.entityType} is not pushable offline`,
        );
    }
  }

  private async pushClient(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.clientsService.remove(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.clientsService.create(
        mutation.payload as unknown as CreateClientDto,
        tenantId,
        userId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      await this.assertNoConflict(
        () =>
          this.prisma.client.findFirst({
            where: { id: mutation.entityId, tenantId },
          }),
        mutation.baseVersion,
      );

      const updated = await this.clientsService.update(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateClientDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: updated,
      };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushContact(tenantId: string, mutation: SyncMutationDto) {
    const clientId = mutation.payload.clientId as string | undefined;
    if (!clientId) {
      throw new BadRequestException('payload.clientId is required for contacts');
    }

    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.clientsService.createContact(
        clientId,
        tenantId,
        mutation.payload as unknown as CreateContactDto,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      await this.assertNoConflict(
        () =>
          this.prisma.contact.findFirst({
            where: { id: mutation.entityId, tenantId },
          }),
        mutation.baseVersion,
      );

      const updated = await this.clientsService.updateContact(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateContactDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: updated,
      };
    }

    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.clientsService.removeContact(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushQuotation(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.quotationsService.remove(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.quotationsService.create(
        mutation.payload as unknown as CreateQuotationDto,
        tenantId,
        userId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }

      const current = await this.prisma.quotation.findFirst({
        where: { id: mutation.entityId, tenantId },
      });
      if (!current) {
        throw new NotFoundException('Quotation not found');
      }
      if (current.status !== QuotationStatus.DRAFT) {
        throw new BadRequestException(
          'Only draft quotations can be updated offline',
        );
      }

      await this.assertNoConflict(() => Promise.resolve(current), mutation.baseVersion);

      const updated = await this.quotationsService.update(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateQuotationDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.() ?? undefined,
        serverEntity: updated,
      };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushOrder(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation === SyncOperation.CONFIRM) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for confirm');
      }
      const confirmed = await this.ordersService.confirm(
        mutation.entityId,
        tenantId,
      );
      return {
        entityId: confirmed.id,
        serverVersion: confirmed.updatedAt?.toISOString?.(),
        serverEntity: confirmed,
      };
    }

    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.ordersService.remove(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.ordersService.create(
        mutation.payload as unknown as CreateOrderDto,
        tenantId,
        userId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.(),
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      const current = await this.prisma.order.findFirst({
        where: { id: mutation.entityId, tenantId },
      });
      if (!current) throw new NotFoundException('Order not found');
      if (current.status !== OrderStatus.DRAFT) {
        throw new BadRequestException('Only draft orders can be updated offline');
      }
      await this.assertNoConflict(() => Promise.resolve(current), mutation.baseVersion);
      const updated = await this.ordersService.update(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateOrderDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.(),
        serverEntity: updated,
      };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushInvoice(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation === SyncOperation.ISSUE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for issue');
      }
      const issued = await this.invoicesService.issue(
        mutation.entityId,
        tenantId,
      );
      return {
        entityId: issued.id,
        serverVersion: issued.updatedAt?.toISOString?.(),
        serverEntity: issued,
      };
    }

    if (mutation.operation === SyncOperation.RECORD_PAYMENT) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for record_payment');
      }
      const payment = await this.paymentsService.recordForInvoice(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as RecordPaymentDto,
        userId,
      );
      return {
        entityId: payment.id,
        serverVersion:
          (payment as { createdAt?: Date }).createdAt?.toISOString?.() ??
          undefined,
        serverEntity: payment,
      };
    }

    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.invoicesService.remove(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.invoicesService.create(
        mutation.payload as unknown as CreateInvoiceDto,
        tenantId,
        userId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.(),
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      const current = await this.prisma.invoice.findFirst({
        where: { id: mutation.entityId, tenantId },
      });
      if (!current) throw new NotFoundException('Invoice not found');
      if (current.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          'Only draft invoices can be updated offline',
        );
      }
      await this.assertNoConflict(() => Promise.resolve(current), mutation.baseVersion);
      const updated = await this.invoicesService.update(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateInvoiceDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.(),
        serverEntity: updated,
      };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushPayment(
    tenantId: string,
    userId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation !== SyncOperation.CREATE) {
      throw new BadRequestException('Payments offline support create only');
    }
    const created = await this.paymentsService.create(
      mutation.payload as unknown as CreatePaymentDto,
      tenantId,
      userId,
    );
    return {
      entityId: created.id,
      serverVersion:
        (created as { createdAt?: Date }).createdAt?.toISOString?.() ??
        undefined,
      serverEntity: created,
    };
  }

  private async pushCatalogCategory(
    tenantId: string,
    mutation: SyncMutationDto,
  ) {
    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.catalogueService.createCategory(
        mutation.payload as unknown as CreateCatalogCategoryDto,
        tenantId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.(),
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      await this.assertNoConflict(
        () =>
          this.prisma.catalogCategory.findFirst({
            where: { id: mutation.entityId, tenantId },
          }),
        mutation.baseVersion,
      );
      const updated = await this.catalogueService.updateCategory(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateCatalogCategoryDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.(),
        serverEntity: updated,
      };
    }

    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.catalogueService.removeCategory(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async pushCatalogItem(tenantId: string, mutation: SyncMutationDto) {
    if (mutation.operation === SyncOperation.CREATE) {
      const created = await this.catalogueService.createItem(
        mutation.payload as unknown as CreateCatalogItemDto,
        tenantId,
      );
      return {
        entityId: created.id,
        serverVersion: created.updatedAt?.toISOString?.(),
        serverEntity: created,
      };
    }

    if (mutation.operation === SyncOperation.UPDATE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for update');
      }
      await this.assertNoConflict(
        () =>
          this.prisma.catalogItem.findFirst({
            where: { id: mutation.entityId, tenantId },
          }),
        mutation.baseVersion,
      );
      const updated = await this.catalogueService.updateItem(
        mutation.entityId,
        tenantId,
        mutation.payload as unknown as UpdateCatalogItemDto,
      );
      return {
        entityId: updated.id,
        serverVersion: updated.updatedAt?.toISOString?.(),
        serverEntity: updated,
      };
    }

    if (mutation.operation === SyncOperation.DELETE) {
      if (!mutation.entityId) {
        throw new BadRequestException('entityId required for delete');
      }
      await this.catalogueService.removeItem(mutation.entityId, tenantId);
      return { entityId: mutation.entityId };
    }

    throw new BadRequestException(`Unsupported operation ${mutation.operation}`);
  }

  private async assertNoConflict(
    load: () => Promise<{ updatedAt: Date } | null>,
    baseVersion?: string,
  ) {
    if (!baseVersion) return;

    const current = await load();
    if (!current) {
      throw new NotFoundException('Entity not found');
    }

    const serverTs = current.updatedAt.getTime();
    const clientTs = new Date(baseVersion).getTime();

    if (Number.isNaN(clientTs)) {
      throw new BadRequestException('Invalid baseVersion');
    }

    if (serverTs > clientTs) {
      throw new ConflictException({
        message: 'Server version is newer than client baseVersion',
        serverVersion: current.updatedAt.toISOString(),
        serverEntity: current,
      });
    }
  }

  private async logMutation(input: {
    tenantId: string;
    userId: string;
    deviceId: string;
    batchId: string;
    mutation: SyncMutationDto;
    status: PrismaSyncMutationStatus;
    entityId?: string;
    errorCode?: string;
  }) {
    await this.prisma.syncMutationLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        deviceId: input.deviceId,
        batchId: input.batchId,
        mutationId: input.mutation.mutationId,
        entityType: input.mutation.entityType,
        operation: input.mutation.operation,
        entityId: input.entityId,
        status: input.status,
        errorCode: input.errorCode,
        payload: input.mutation.payload as Prisma.InputJsonValue,
      },
    });
  }
}
