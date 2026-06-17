import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  buildNextCursor,
  buildUpdatedAtCursorWhere,
  decodeSyncCursor,
} from './utils/sync-cursor.util';

const DEFAULT_PULL_LIMIT = 200;
const MAX_PULL_LIMIT = 500;

const QUOTATION_OFFLINE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
] as const;

const INVOICE_OFFLINE_STATUSES = [
  'draft',
  'issued',
  'sent',
  'partial',
  'paid',
  'overdue',
] as const;

const ORDER_INCLUDE = {
  lines: { orderBy: { position: 'asc' as const } },
  client: { select: { id: true, companyName: true } },
};

const INVOICE_INCLUDE = {
  lines: { orderBy: { position: 'asc' as const } },
  client: { select: { id: true, companyName: true } },
};

@Injectable()
export class SyncPullService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(tenantId: string) {
    const [
      taxRates,
      paymentTerms,
      categories,
      items,
      clients,
      quotations,
      orders,
      invoices,
      payments,
    ] = await Promise.all([
      this.prisma.taxRate.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.paymentTerm.findMany({
        where: { tenantId },
        orderBy: { days: 'asc' },
      }),
      this.prisma.catalogCategory.findMany({
        where: { tenantId, isArchived: false },
        orderBy: { name: 'asc' },
      }),
      this.prisma.catalogItem.findMany({
        where: { tenantId, isArchived: false },
        include: { prices: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.findMany({
        where: { tenantId, deletedAt: null },
        include: { contacts: true },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
      this.prisma.quotation.findMany({
        where: {
          tenantId,
          status: { in: [...QUOTATION_OFFLINE_STATUSES] },
        },
        include: { lines: { orderBy: { position: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      this.prisma.order.findMany({
        where: { tenantId, status: { not: 'cancelled' } },
        include: ORDER_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: [...INVOICE_OFFLINE_STATUSES] },
        },
        include: INVOICE_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      this.prisma.payment.findMany({
        where: { tenantId, isCancelled: false },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: {
          imputations: { include: { invoice: { select: { id: true, number: true } } } },
        },
      }),
    ]);

    const watermark = this.collectWatermark([
      ...clients,
      ...clients.flatMap((c) => c.contacts),
      ...categories,
      ...items,
      ...quotations,
      ...orders,
      ...invoices,
      ...payments.map((p) => ({ ...p, updatedAt: p.createdAt })),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      cursor: buildNextCursor(
        watermark.length > 0 ? [watermark[watermark.length - 1]] : [],
        null,
      ),
      reference: { taxRates, paymentTerms },
      changes: {
        clients: clients.map((c) => this.mapClient(c)),
        contacts: clients.flatMap((c) =>
          c.contacts.map((contact) => this.mapContact(contact)),
        ),
        catalogCategories: categories,
        catalogItems: items,
        quotations,
        orders,
        invoices,
        payments,
      },
      tombstones: [],
    };
  }

  async pull(tenantId: string, cursorRaw?: string, limitRaw?: number) {
    const limit = Math.min(
      Math.max(limitRaw ?? DEFAULT_PULL_LIMIT, 1),
      MAX_PULL_LIMIT,
    );
    const cursor = decodeSyncCursor(cursorRaw);
    const cursorWhere = buildUpdatedAtCursorWhere(cursor);

    const withCursor = (extra?: Record<string, unknown>) => ({
      tenantId,
      ...(cursorWhere ?? {}),
      ...extra,
    });

    const [
      clients,
      contacts,
      categories,
      items,
      quotations,
      orders,
      invoices,
      payments,
      clientTombstones,
      catalogCategoryTombstones,
      catalogItemTombstones,
    ] = await Promise.all([
      this.prisma.client.findMany({
        where: withCursor(),
        include: { contacts: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.contact.findMany({
        where: withCursor(),
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.catalogCategory.findMany({
        where: withCursor({ isArchived: false }),
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.catalogItem.findMany({
        where: withCursor({ isArchived: false }),
        include: { prices: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.quotation.findMany({
        where: withCursor({
          status: { in: [...QUOTATION_OFFLINE_STATUSES] },
        }),
        include: { lines: { orderBy: { position: 'asc' } } },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.order.findMany({
        where: withCursor({ status: { not: 'cancelled' } }),
        include: ORDER_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.invoice.findMany({
        where: withCursor({
          status: { in: [...INVOICE_OFFLINE_STATUSES] },
        }),
        include: INVOICE_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          isCancelled: false,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.at) } },
                  ...(cursor.id
                    ? [{ createdAt: new Date(cursor.at), id: { gt: cursor.id } }]
                    : []),
                ],
              }
            : {}),
        },
        include: {
          imputations: {
            include: { invoice: { select: { id: true, number: true } } },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.client.findMany({
        where: {
          tenantId,
          deletedAt: { not: null },
          ...(cursor ? { deletedAt: { gt: new Date(cursor.at) } } : {}),
        },
        select: { id: true, deletedAt: true },
        orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.catalogCategory.findMany({
        where: {
          tenantId,
          isArchived: true,
          ...(cursorWhere ?? {}),
        },
        select: { id: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.catalogItem.findMany({
        where: {
          tenantId,
          isArchived: true,
          ...(cursorWhere ?? {}),
        },
        select: { id: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
    ]);

    const watermark = this.collectWatermark([
      ...clients,
      ...contacts,
      ...categories,
      ...items,
      ...quotations,
      ...orders,
      ...invoices,
      ...payments.map((p) => ({ ...p, updatedAt: p.createdAt })),
    ]);

    const hasMore =
      clients.length === limit ||
      contacts.length === limit ||
      categories.length === limit ||
      items.length === limit ||
      quotations.length === limit ||
      orders.length === limit ||
      invoices.length === limit ||
      payments.length === limit;

    return {
      pulledAt: new Date().toISOString(),
      cursor: buildNextCursor(
        watermark.length > 0 ? [watermark[watermark.length - 1]] : [],
        cursor,
      ),
      hasMore,
      changes: {
        clients: clients.map((c) => this.mapClient(c)),
        contacts: contacts.map((c) => this.mapContact(c)),
        catalogCategories: categories,
        catalogItems: items,
        quotations,
        orders,
        invoices,
        payments,
      },
      tombstones: [
        ...clientTombstones.map((t) => ({
          entityType: 'client',
          entityId: t.id,
          deletedAt: t.deletedAt?.toISOString(),
        })),
        ...catalogCategoryTombstones.map((t) => ({
          entityType: 'catalog_category',
          entityId: t.id,
          deletedAt: t.updatedAt.toISOString(),
        })),
        ...catalogItemTombstones.map((t) => ({
          entityType: 'catalog_item',
          entityId: t.id,
          deletedAt: t.updatedAt.toISOString(),
        })),
      ],
    };
  }

  private collectWatermark(items: Array<{ updatedAt: Date; id: string }>) {
    return [...items].sort((a, b) => {
      const delta = a.updatedAt.getTime() - b.updatedAt.getTime();
      return delta !== 0 ? delta : a.id.localeCompare(b.id);
    });
  }

  private mapClient(client: {
    id: string;
    updatedAt: Date;
    deletedAt: Date | null;
    isArchived: boolean;
    contacts: unknown[];
    [key: string]: unknown;
  }) {
    const { contacts: _contacts, ...rest } = client;
    return {
      ...rest,
      archived: client.isArchived || client.deletedAt != null,
    };
  }

  private mapContact(contact: Record<string, unknown>) {
    return contact;
  }
}
