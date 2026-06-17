import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class CabinetService {
  constructor(private readonly prisma: PrismaService) {}

  async listLinkedCompanies(cabinetTenantId: string) {
    const links = await this.prisma.cabinetCompanyAccess.findMany({
      where: { cabinetTenantId },
      include: {
        companyTenant: { select: { id: true, name: true, type: true } },
      },
    });
    return links.map((link) => link.companyTenant);
  }

  async grantAccess(
    cabinetTenantId: string,
    companyTenantId: string,
    actorTenantId: string,
  ) {
    if (actorTenantId !== companyTenantId) {
      throw new ForbiddenException(
        "Seule l'entreprise peut autoriser un cabinet",
      );
    }

    const [cabinet, company] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: cabinetTenantId } }),
      this.prisma.tenant.findUnique({ where: { id: companyTenantId } }),
    ]);

    if (!cabinet || cabinet.type !== TenantType.cabinet) {
      throw new BadRequestException('Cabinet comptable invalide');
    }
    if (!company || company.type !== TenantType.company) {
      throw new BadRequestException('Entreprise cliente invalide');
    }

    return this.prisma.cabinetCompanyAccess.upsert({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId,
        },
      },
      create: { cabinetTenantId, companyTenantId },
      update: {},
    });
  }

  async listCompanyInvoices(
    cabinetTenantId: string,
    companyTenantId: string,
    page = 1,
    limit = 50,
  ) {
    await this.assertCabinetAccess(cabinetTenantId, companyTenantId);

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId: companyTenantId },
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
        include: { client: { select: { companyName: true } } },
      }),
      this.prisma.invoice.count({ where: { tenantId: companyTenantId } }),
    ]);

    return { items, total, page, limit };
  }

  private async assertCabinetAccess(
    cabinetTenantId: string,
    companyTenantId: string,
  ) {
    const link = await this.prisma.cabinetCompanyAccess.findUnique({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId,
        },
      },
    });
    if (!link) {
      throw new NotFoundException(
        'Accès cabinet non autorisé pour cette entreprise',
      );
    }
  }
}
