import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../shared/constants/crm-messages';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { buildLocationCode } from './utils/location-code.util';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWarehouseDto, tenantId: string) {
    await this.assertCodeAvailable(tenantId, dto.code);

    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.warehouse.count({ where: { tenantId } });
      // RM-E03 : premier entrepôt = défaut ; sinon honorer isDefault
      const makeDefault = existingCount === 0 || dto.isDefault === true;

      if (makeDefault) {
        await tx.warehouse.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          address: (dto.address as Prisma.InputJsonValue) ?? undefined,
          isDefault: makeDefault,
          isActive: dto.isActive ?? true,
          managerUserId: dto.managerUserId,
        },
        include: { locations: true },
      });
    });
  }

  async findAll(tenantId: string, includeArchived = true) {
    return this.prisma.warehouse.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
      include: { locations: { orderBy: { code: 'asc' } } },
    });
  }

  async findOne(id: string, tenantId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: { locations: { orderBy: { code: 'asc' } } },
    });
    if (!warehouse) {
      throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
    }
    return warehouse;
  }

  async update(id: string, tenantId: string, dto: UpdateWarehouseDto) {
    const current = await this.findOne(id, tenantId);

    // RM-E02 — archivage
    if (dto.isActive === false && current.isActive) {
      await this.assertCanArchive(id, tenantId);
      if (current.isDefault) {
        throw new BadRequestException(
          CrmMessages.stock.WAREHOUSE_DEFAULT_REQUIRED,
        );
      }
    }

    // RM-E03 — ne pas retirer le défaut sans en désigner un autre
    if (dto.isDefault === false && current.isDefault) {
      throw new BadRequestException(
        CrmMessages.stock.WAREHOUSE_DEFAULT_REQUIRED,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.warehouse.updateMany({
          where: { tenantId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          address:
            dto.address === undefined
              ? undefined
              : (dto.address as Prisma.InputJsonValue),
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          managerUserId: dto.managerUserId,
        },
        include: { locations: { orderBy: { code: 'asc' } } },
      });
    });
  }

  /** RM-E03 — désigner explicitement l’entrepôt par défaut. */
  async setDefault(id: string, tenantId: string) {
    const warehouse = await this.findOne(id, tenantId);
    if (!warehouse.isActive) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_ARCHIVED);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.warehouse.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.warehouse.update({
        where: { id },
        data: { isDefault: true },
        include: { locations: { orderBy: { code: 'asc' } } },
      });
    });
  }

  /** RM-E02 — archivage (pas de suppression). */
  async archive(id: string, tenantId: string) {
    return this.update(id, tenantId, { isActive: false });
  }

  async reactivate(id: string, tenantId: string) {
    return this.update(id, tenantId, { isActive: true });
  }

  async createLocation(
    warehouseId: string,
    tenantId: string,
    dto: CreateWarehouseLocationDto,
  ) {
    const warehouse = await this.findOne(warehouseId, tenantId);
    if (!warehouse.isActive) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_ARCHIVED);
    }

    const zone = dto.zone?.trim();
    const aisle = dto.aisle?.trim();
    const rack = dto.rack?.trim();
    const bin = dto.bin?.trim();
    if (!zone || !aisle || !rack || !bin) {
      throw new BadRequestException(
        CrmMessages.stock.LOCATION_HIERARCHY_REQUIRED,
      );
    }

    const code = buildLocationCode({
      warehouseCode: warehouse.code,
      zone,
      aisle,
      rack,
      bin,
    });
    await this.assertLocationCodeAvailable(tenantId, code);

    return this.prisma.warehouseLocation.create({
      data: {
        tenantId,
        warehouseId,
        code,
        zone: zone.toUpperCase(),
        aisle: aisle.toUpperCase(),
        rack: rack.toUpperCase(),
        bin: bin.toUpperCase(),
        capacity: dto.capacity,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateLocation(
    warehouseId: string,
    locationId: string,
    tenantId: string,
    dto: UpdateWarehouseLocationDto,
  ) {
    const warehouse = await this.findOne(warehouseId, tenantId);
    if (!warehouse.isActive) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_ARCHIVED);
    }

    const location = await this.prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouseId, tenantId },
    });
    if (!location) {
      throw new NotFoundException(CrmMessages.stock.LOCATION_NOT_FOUND);
    }

    return this.prisma.warehouseLocation.update({
      where: { id: locationId },
      data: {
        capacity: dto.capacity,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * RM-E02 — stock présent = articles liés avec quantité miroir > 0.
   * (évoluera vers stock_levels.qty_on_hand quand disponible)
   */
  private async assertCanArchive(warehouseId: string, tenantId: string) {
    const levelWithStock = await this.prisma.stockLevel.findFirst({
      where: { tenantId, warehouseId, qtyOnHand: { gt: 0 } },
      select: { id: true },
    });
    if (levelWithStock) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_HAS_STOCK);
    }

    const withStock = await this.prisma.stockItem.findFirst({
      where: {
        tenantId,
        defaultWarehouseId: warehouseId,
        commercialItem: { stockQuantity: { gt: 0 } },
      },
      select: { id: true },
    });
    if (withStock) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_HAS_STOCK);
    }
  }

  private async assertCodeAvailable(
    tenantId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.warehouse.findFirst({
      where: {
        tenantId,
        code: code.trim().toUpperCase(),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(CrmMessages.stock.WAREHOUSE_CODE_EXISTS);
    }
  }

  private async assertLocationCodeAvailable(
    tenantId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: {
        tenantId,
        code: code.trim().toUpperCase(),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(CrmMessages.stock.LOCATION_CODE_EXISTS);
    }
  }
}
