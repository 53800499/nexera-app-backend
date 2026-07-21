import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogItemType, Prisma, StockValuationMethod } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../shared/constants/crm-messages';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';

const stockItemInclude = {
  commercialItem: {
    select: {
      id: true,
      reference: true,
      name: true,
      unit: true,
      itemType: true,
      stockQuantity: true,
      isArchived: true,
    },
  },
  defaultWarehouse: true,
  defaultLocation: true,
} satisfies Prisma.StockItemInclude;

@Injectable()
export class StockItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findArticles(tenantId: string, q?: string) {
    const search = q?.trim();
    const items = await this.prisma.catalogItem.findMany({
      where: {
        tenantId,
        itemType: CatalogItemType.product,
        ...(search
          ? {
              OR: [
                { reference: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        reference: true,
        name: true,
        unit: true,
        stockQuantity: true,
        isArchived: true,
        stockItem: {
          include: {
            defaultWarehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return items.map((item) => ({
      catalogItemId: item.id,
      reference: item.reference,
      name: item.name,
      unit: item.unit,
      stockQuantity: item.stockQuantity ?? 0,
      isArchived: item.isArchived,
      configured: Boolean(item.stockItem),
      stockItem: item.stockItem,
    }));
  }

  async findAll(tenantId: string) {
    return this.prisma.stockItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: stockItemInclude,
    });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, tenantId },
      include: stockItemInclude,
    });
    if (!item) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }
    return item;
  }

  async findByCatalogItem(catalogItemId: string, tenantId: string) {
    const catalogItem = await this.prisma.catalogItem.findFirst({
      where: { id: catalogItemId, tenantId },
      select: {
        id: true,
        reference: true,
        name: true,
        unit: true,
        itemType: true,
        stockQuantity: true,
        isArchived: true,
      },
    });
    if (!catalogItem) {
      throw new NotFoundException(CrmMessages.stock.CATALOG_ITEM_NOT_FOUND);
    }

    const stockItem = await this.prisma.stockItem.findFirst({
      where: { commercialItemId: catalogItemId, tenantId },
      include: stockItemInclude,
    });

    return { catalogItem, stockItem };
  }

  async create(dto: CreateStockItemDto, tenantId: string) {
    this.assertThresholds(dto);
    this.assertConversionFactor(dto.conversionFactor);

    const catalogItem = await this.prisma.catalogItem.findFirst({
      where: { id: dto.commercialItemId, tenantId },
    });
    if (!catalogItem) {
      throw new NotFoundException(CrmMessages.stock.CATALOG_ITEM_NOT_FOUND);
    }
    if (catalogItem.itemType !== CatalogItemType.product) {
      throw new BadRequestException(
        CrmMessages.stock.CATALOG_ITEM_NOT_PRODUCT,
      );
    }

    const existing = await this.prisma.stockItem.findFirst({
      where: { commercialItemId: dto.commercialItemId, tenantId },
    });
    if (existing) {
      throw new BadRequestException(CrmMessages.stock.STOCK_ITEM_EXISTS);
    }

    await this.assertWarehouseAndLocation(
      tenantId,
      dto.defaultWarehouseId,
      dto.defaultLocationId,
    );

    return this.prisma.stockItem.create({
      data: {
        tenantId,
        commercialItemId: dto.commercialItemId,
        trackLots: dto.trackLots ?? false,
        trackSerials: dto.trackSerials ?? false,
        trackExpiry: dto.trackExpiry ?? false,
        valuationMethod:
          (dto.valuationMethod as StockValuationMethod) ??
          StockValuationMethod.cmup,
        storageUnit: dto.storageUnit.trim(),
        conversionFactor: dto.conversionFactor ?? 1,
        minStockQty: dto.minStockQty,
        safetyStockQty: dto.safetyStockQty,
        maxStockQty: dto.maxStockQty,
        reorderQty: dto.reorderQty,
        defaultWarehouseId: dto.defaultWarehouseId,
        defaultLocationId: dto.defaultLocationId,
        allowNegativeStock: dto.allowNegativeStock ?? false,
      },
      include: stockItemInclude,
    });
  }

  async update(id: string, tenantId: string, dto: UpdateStockItemDto) {
    const current = await this.findOne(id, tenantId);
    this.assertThresholds({
      minStockQty: dto.minStockQty ?? current.minStockQty ?? undefined,
      safetyStockQty: dto.safetyStockQty ?? current.safetyStockQty ?? undefined,
      maxStockQty: dto.maxStockQty ?? current.maxStockQty ?? undefined,
    });
    if (dto.conversionFactor !== undefined) {
      this.assertConversionFactor(dto.conversionFactor);
    }

    if (
      dto.valuationMethod !== undefined &&
      dto.valuationMethod !== current.valuationMethod
    ) {
      const qty = current.commercialItem.stockQuantity ?? 0;
      if (qty > 0) {
        throw new BadRequestException(
          CrmMessages.stock.VALUATION_METHOD_IMMUTABLE,
        );
      }
    }

    const warehouseId =
      dto.defaultWarehouseId === undefined
        ? current.defaultWarehouseId
        : dto.defaultWarehouseId;
    const locationId =
      dto.defaultLocationId === undefined
        ? current.defaultLocationId
        : dto.defaultLocationId;

    await this.assertWarehouseAndLocation(
      tenantId,
      warehouseId ?? undefined,
      locationId ?? undefined,
    );

    return this.prisma.stockItem.update({
      where: { id },
      data: {
        trackLots: dto.trackLots,
        trackSerials: dto.trackSerials,
        trackExpiry: dto.trackExpiry,
        valuationMethod: dto.valuationMethod as StockValuationMethod | undefined,
        storageUnit: dto.storageUnit?.trim(),
        conversionFactor: dto.conversionFactor,
        minStockQty: dto.minStockQty,
        safetyStockQty: dto.safetyStockQty,
        maxStockQty: dto.maxStockQty,
        reorderQty: dto.reorderQty,
        defaultWarehouseId: dto.defaultWarehouseId,
        defaultLocationId: dto.defaultLocationId,
        allowNegativeStock: dto.allowNegativeStock,
      },
      include: stockItemInclude,
    });
  }

  private assertThresholds(dto: {
    minStockQty?: number | null;
    safetyStockQty?: number | null;
    maxStockQty?: number | null;
  }) {
    const safety = dto.safetyStockQty;
    const min = dto.minStockQty;
    const max = dto.maxStockQty;

    if (
      safety != null &&
      min != null &&
      safety > min
    ) {
      throw new BadRequestException(CrmMessages.stock.THRESHOLDS_INVALID);
    }
    if (min != null && max != null && min > max) {
      throw new BadRequestException(CrmMessages.stock.THRESHOLDS_INVALID);
    }
  }

  private assertConversionFactor(factor?: number) {
    if (factor !== undefined && factor <= 0) {
      throw new BadRequestException(
        CrmMessages.stock.CONVERSION_FACTOR_INVALID,
      );
    }
  }

  private async assertWarehouseAndLocation(
    tenantId: string,
    warehouseId?: string | null,
    locationId?: string | null,
  ) {
    if (warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, tenantId },
      });
      if (!warehouse) {
        throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
      }
    }

    if (locationId) {
      const location = await this.prisma.warehouseLocation.findFirst({
        where: { id: locationId, tenantId },
      });
      if (!location) {
        throw new NotFoundException(CrmMessages.stock.LOCATION_NOT_FOUND);
      }
      if (warehouseId && location.warehouseId !== warehouseId) {
        throw new BadRequestException(
          CrmMessages.stock.LOCATION_WAREHOUSE_MISMATCH,
        );
      }
    }
  }
}
