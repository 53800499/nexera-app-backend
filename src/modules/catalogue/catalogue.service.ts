import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../shared/constants/crm-messages';
import { CreateCatalogCategoryDto } from './dto/create-catalog-category.dto';
import { UpdateCatalogCategoryDto } from './dto/update-catalog-category.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CreateCatalogPriceDto } from './dto/create-catalog-price.dto';
import { UpdateCatalogPriceDto } from './dto/update-catalog-price.dto';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { SettingsService } from '../settings/settings.service';
import { NumberingDocumentType } from '../settings/enums/numbering-document-type.enum';

@Injectable()
export class CatalogueService {
  constructor(
    private prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly settingsService: SettingsService,
  ) {}

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

    if (!category) throw new NotFoundException(CrmMessages.catalogue.CATEGORY_NOT_FOUND);
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
      throw new BadRequestException(CrmMessages.catalogue.PRICE_NEGATIVE);
    }

    const taxRate = await this.prisma.taxRate.findFirst({
      where: { id: dto.defaultTaxRateId, tenantId, isActive: true },
    });

    if (!taxRate) {
      throw new BadRequestException(CrmMessages.catalogue.TAX_RATE_NOT_FOUND);
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

    if (!item) throw new NotFoundException(CrmMessages.catalogue.ITEM_NOT_FOUND);
    return item;
  }

  async updateItem(id: string, tenantId: string, dto: UpdateCatalogItemDto) {
    const item = await this.findOneItem(id, tenantId);

    if (dto.priceHt !== undefined && dto.priceHt < 0) {
      throw new BadRequestException(CrmMessages.catalogue.PRICE_NEGATIVE);
    }

    if (dto.defaultTaxRateId) {
      const taxRate = await this.prisma.taxRate.findFirst({
        where: { id: dto.defaultTaxRateId, tenantId, isActive: true },
      });

      if (!taxRate) {
        throw new BadRequestException(CrmMessages.catalogue.TAX_RATE_NOT_FOUND);
      }
    }

    if (dto.reference) {
      const exists = await this.prisma.catalogItem.findFirst({
        where: { tenantId, reference: dto.reference, NOT: { id } },
      });

      if (exists) {
        throw new BadRequestException(CrmMessages.catalogue.REFERENCE_EXISTS);
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

    const [usedInQuotation, usedInOrder, usedInInvoice] = await Promise.all([
      this.prisma.quotationLine.findFirst({ where: { tenantId, itemId: id } }),
      this.prisma.orderLine.findFirst({ where: { tenantId, itemId: id } }),
      this.prisma.invoiceLine.findFirst({ where: { tenantId, itemId: id } }),
    ]);

    if (usedInQuotation || usedInOrder || usedInInvoice) {
      throw new BadRequestException(CrmMessages.catalogue.ITEM_USED_IN_TRANSACTIONS);
    }

    await this.prisma.catalogItem.update({
      where: { id },
      data: { isArchived: true },
    });

    return { message: 'Item archived successfully', itemId: item.id };
  }

  async activateItem(id: string, tenantId: string) {
    const item = await this.findOneItem(id, tenantId);

    if (!item.isArchived) {
      return item;
    }

    return this.prisma.catalogItem.update({
      where: { id },
      data: { isArchived: false },
      include: { category: true, taxRate: true, prices: true },
    });
  }

  async createPrice(itemId: string, tenantId: string, dto: CreateCatalogPriceDto) {
    await this.findOneItem(itemId, tenantId);

    if (dto.priceHt < 0) throw new BadRequestException(CrmMessages.catalogue.PRICE_NEGATIVE);

    const tenantSettings = await this.settingsService.getTenantSettings(tenantId);

    return this.prisma.catalogItemPrice.create({
      data: {
        tenantId,
        itemId,
        clientId: dto.clientId,
        groupName: dto.groupName,
        priceHt: dto.priceHt,
        currency: dto.currency ?? tenantSettings.primaryCurrency,
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
      include: {
        client: { select: { id: true, companyName: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePrice(priceId: string, tenantId: string) {
    const price = await this.prisma.catalogItemPrice.findFirst({
      where: { id: priceId, tenantId },
      include: {
        client: { select: { id: true, companyName: true, code: true } },
        item: { select: { id: true, name: true, reference: true, isArchived: true } },
      },
    });

    if (!price) {
      throw new NotFoundException(CrmMessages.catalogue.PRICE_NOT_FOUND);
    }

    return price;
  }

  async updatePrice(
    priceId: string,
    tenantId: string,
    dto: UpdateCatalogPriceDto,
  ) {
    const price = await this.findOnePrice(priceId, tenantId);

    if (dto.priceHt !== undefined && dto.priceHt < 0) {
      throw new BadRequestException(CrmMessages.catalogue.PRICE_NEGATIVE);
    }

    return this.prisma.catalogItemPrice.update({
      where: { id: price.id },
      data: {
        priceHt: dto.priceHt,
        currency: dto.currency,
        validFrom:
          dto.validFrom !== undefined
            ? dto.validFrom
              ? new Date(dto.validFrom)
              : null
            : undefined,
        validTo:
          dto.validTo !== undefined
            ? dto.validTo
              ? new Date(dto.validTo)
              : null
            : undefined,
        isActive: dto.isActive,
      },
      include: {
        client: { select: { id: true, companyName: true, code: true } },
      },
    });
  }

  private async generateReference(tenantId: string, explicit?: string) {
    if (explicit && explicit.trim()) {
      const existing = await this.prisma.catalogItem.findFirst({
        where: { tenantId, reference: explicit.trim().toUpperCase() },
      });
      if (existing) throw new BadRequestException(CrmMessages.catalogue.REFERENCE_EXISTS);
      return explicit.trim().toUpperCase();
    }

    return this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.CATALOG_ITEM,
    );
  }
}
