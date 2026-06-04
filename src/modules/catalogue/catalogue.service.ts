import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateCatalogCategoryDto } from './dto/create-catalog-category.dto';
import { UpdateCatalogCategoryDto } from './dto/update-catalog-category.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CreateCatalogPriceDto } from './dto/create-catalog-price.dto';

@Injectable()
export class CatalogueService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCatalogCategoryDto, tenantId: string) {
    return this.prisma.catalogCategory.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code ?? undefined,
        description: dto.description,
        parentId: dto.parentId,
        isArchived: false,
      },
    });
  }

  async findAllCategories(tenantId: string) {
    return this.prisma.catalogCategory.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { children: true, parent: true },
    });
  }

  async findOneCategory(id: string, tenantId: string) {
    const category = await this.prisma.catalogCategory.findFirst({
      where: { id, tenantId },
      include: { children: true, parent: true, items: true },
    });

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(id: string, tenantId: string, dto: UpdateCatalogCategoryDto) {
    await this.findOneCategory(id, tenantId);
    return this.prisma.catalogCategory.update({
      where: { id },
      data: dto,
    });
  }

  async removeCategory(id: string, tenantId: string) {
    await this.findOneCategory(id, tenantId);
    await this.prisma.catalogCategory.delete({ where: { id } });
    return { message: 'Category deleted successfully' };
  }

  async createItem(dto: CreateCatalogItemDto, tenantId: string) {
    if (dto.priceHt < 0) {
      throw new BadRequestException('Price HT cannot be negative');
    }

    const taxRate = await this.prisma.taxRate.findFirst({
      where: { id: dto.defaultTaxRateId, tenantId },
    });

    if (!taxRate) {
      throw new BadRequestException('Tax rate not found for this tenant');
    }

    const reference = await this.generateReference(tenantId, dto.reference);

    return this.prisma.catalogItem.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        reference,
        name: dto.name,
        description: dto.description,
        itemType: dto.itemType as any,
        unit: dto.unit ?? 'unit',
        priceHt: dto.priceHt,
        defaultTaxRateId: dto.defaultTaxRateId,
        maxDiscountPct: dto.maxDiscountPct ?? 0,
        isArchived: dto.isArchived ?? false,
      },
      include: {
        category: true,
        taxRate: true,
        prices: true,
      },
    });
  }

  async findAllItems(tenantId: string, q?: string) {
    const where: any = { tenantId };

    if (q) {
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.catalogItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { category: true, taxRate: true, prices: true },
    });
  }

  async findOneItem(id: string, tenantId: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, tenantId },
      include: { category: true, taxRate: true, prices: true },
    });

    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async updateItem(id: string, tenantId: string, dto: UpdateCatalogItemDto) {
    const item = await this.findOneItem(id, tenantId);

    if (dto.priceHt !== undefined && dto.priceHt < 0) {
      throw new BadRequestException('Price HT cannot be negative');
    }

    if (dto.defaultTaxRateId) {
      const taxRate = await this.prisma.taxRate.findFirst({
        where: { id: dto.defaultTaxRateId, tenantId },
      });

      if (!taxRate) {
        throw new BadRequestException('Tax rate not found for this tenant');
      }
    }

    if (dto.reference) {
      const exists = await this.prisma.catalogItem.findFirst({
        where: { tenantId, reference: dto.reference, NOT: { id } },
      });

      if (exists) {
        throw new BadRequestException('Item reference already exists');
      }
    }

    return this.prisma.catalogItem.update({
      where: { id },
      data: {
        ...dto,
        itemType: dto.itemType as any,
      },
      include: { category: true, taxRate: true, prices: true },
    });
  }

  async removeItem(id: string, tenantId: string) {
    const item = await this.findOneItem(id, tenantId);

    const usedInQuotation = await this.prisma.quotationLine.findFirst({
      where: { tenantId, itemId: id },
    });
    const usedInInvoice = await this.prisma.invoiceLine.findFirst({
      where: { tenantId, itemId: id },
    });

    if (usedInQuotation || usedInInvoice) {
      throw new BadRequestException('Item is used in transactions; archive it instead of deleting it.');
    }

    await this.prisma.catalogItem.update({
      where: { id },
      data: { isArchived: true },
    });

    return { message: 'Item archived successfully', itemId: item.id };
  }

  async createPrice(itemId: string, tenantId: string, dto: CreateCatalogPriceDto) {
    await this.findOneItem(itemId, tenantId);

    if (dto.priceHt < 0) throw new BadRequestException('Price HT cannot be negative');

    return this.prisma.catalogItemPrice.create({
      data: {
        tenantId,
        itemId,
        clientId: dto.clientId,
        groupName: dto.groupName,
        priceHt: dto.priceHt,
        currency: dto.currency ?? 'EUR',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findPrices(itemId: string, tenantId: string) {
    await this.findOneItem(itemId, tenantId);
    return this.prisma.catalogItemPrice.findMany({
      where: { itemId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async generateReference(tenantId: string, explicit?: string) {
    if (explicit && explicit.trim()) {
      const existing = await this.prisma.catalogItem.findFirst({
        where: { tenantId, reference: explicit.trim().toUpperCase() },
      });
      if (existing) throw new BadRequestException('Item reference already exists');
      return explicit.trim().toUpperCase();
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `ART-${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await this.prisma.catalogItem.findFirst({
        where: { tenantId, reference: candidate },
      });
      if (!existing) return candidate;
    }

    throw new BadRequestException('Unable to generate a unique item reference');
  }
}
