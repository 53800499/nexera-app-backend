import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CabinetMessages } from './constants/cabinet-messages';
import {
  generateCabinetInviteCode,
  normalizeCabinetInviteCode,
} from './utils/cabinet-invite.util';
import type { CabinetAccessDto } from './dto/cabinet-access.dto';
import {
  CABINET_SCOPE_PERMISSIONS,
  type CabinetScopePermissionCode,
  normalizeCabinetLinkPermissions,
} from './constants/cabinet-scope.constants';

@Injectable()
export class CabinetService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCabinetTenant(cabinetTenantId: string) {
    const cabinet = await this.prisma.tenant.findUnique({
      where: { id: cabinetTenantId },
    });
    if (!cabinet || cabinet.type !== TenantType.cabinet) {
      throw new BadRequestException(CabinetMessages.INVALID_CABINET);
    }
    return cabinet;
  }

  private async createUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const inviteCode = generateCabinetInviteCode();
      const existing = await this.prisma.tenant.findUnique({
        where: { cabinetInviteCode: inviteCode },
      });
      if (!existing) {
        return inviteCode;
      }
    }
    throw new BadRequestException(
      "Impossible de générer un code d'invitation unique.",
    );
  }

  async getInviteCode(cabinetTenantId: string) {
    const cabinet = await this.assertCabinetTenant(cabinetTenantId);
    if (cabinet.cabinetInviteCode) {
      return { inviteCode: cabinet.cabinetInviteCode };
    }

    const inviteCode = await this.createUniqueInviteCode();
    await this.prisma.tenant.update({
      where: { id: cabinetTenantId },
      data: { cabinetInviteCode: inviteCode },
    });

    return { inviteCode };
  }

  async regenerateInviteCode(cabinetTenantId: string) {
    await this.assertCabinetTenant(cabinetTenantId);
    const inviteCode = await this.createUniqueInviteCode();
    await this.prisma.tenant.update({
      where: { id: cabinetTenantId },
      data: { cabinetInviteCode: inviteCode },
    });
    return { inviteCode };
  }

  private async resolveCabinetTenantIdFromInviteCode(rawCode: string) {
    const inviteCode = normalizeCabinetInviteCode(rawCode);
    const cabinet = await this.prisma.tenant.findFirst({
      where: { cabinetInviteCode: inviteCode, type: TenantType.cabinet },
    });
    if (!cabinet) {
      throw new BadRequestException(CabinetMessages.INVALID_INVITE_CODE);
    }
    return cabinet.id;
  }

  async grantAccessFromDto(
    dto: CabinetAccessDto,
    companyTenantId: string,
    actorTenantId: string,
  ) {
    let cabinetTenantId = dto.cabinetTenantId;

    if (dto.inviteCode) {
      cabinetTenantId = await this.resolveCabinetTenantIdFromInviteCode(
        dto.inviteCode,
      );
    }

    if (!cabinetTenantId) {
      throw new BadRequestException(CabinetMessages.INVITE_IDENTIFIER_REQUIRED);
    }

    return this.grantAccess(
      cabinetTenantId,
      companyTenantId,
      actorTenantId,
      dto.permissions,
    );
  }

  async listLinkedCompanies(cabinetTenantId: string) {
    const links = await this.prisma.cabinetCompanyAccess.findMany({
      where: { cabinetTenantId },
      include: {
        companyTenant: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link) => ({
      id: link.companyTenant.id,
      name: link.companyTenant.name,
      type: link.companyTenant.type,
      linkedAt: link.createdAt,
      permissions: normalizeCabinetLinkPermissions(link.permissions),
    }));
  }

  async listAuthorizedCabinets(companyTenantId: string) {
    const company = await this.prisma.tenant.findUnique({
      where: { id: companyTenantId },
    });
    if (!company || company.type !== TenantType.company) {
      throw new BadRequestException(CabinetMessages.COMPANY_ONLY_LIST);
    }

    const links = await this.prisma.cabinetCompanyAccess.findMany({
      where: { companyTenantId },
      include: {
        cabinetTenant: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link) => ({
      id: link.cabinetTenant.id,
      name: link.cabinetTenant.name,
      type: link.cabinetTenant.type,
      linkedAt: link.createdAt,
      permissions: normalizeCabinetLinkPermissions(link.permissions),
    }));
  }

  async grantAccess(
    cabinetTenantId: string,
    companyTenantId: string,
    actorTenantId: string,
    permissionsInput?: string[] | null,
  ) {
    if (actorTenantId !== companyTenantId) {
      throw new ForbiddenException(CabinetMessages.ONLY_COMPANY_CAN_GRANT);
    }

    const [cabinet, company] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: cabinetTenantId } }),
      this.prisma.tenant.findUnique({ where: { id: companyTenantId } }),
    ]);

    if (!cabinet || cabinet.type !== TenantType.cabinet) {
      throw new BadRequestException(CabinetMessages.INVALID_CABINET);
    }
    if (!company || company.type !== TenantType.company) {
      throw new BadRequestException(CabinetMessages.INVALID_COMPANY);
    }

    const permissions = normalizeCabinetLinkPermissions(permissionsInput);

    const link = await this.prisma.cabinetCompanyAccess.upsert({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId,
        },
      },
      create: { cabinetTenantId, companyTenantId, permissions },
      update: { permissions },
    });

    return {
      message: CabinetMessages.ACCESS_GRANTED,
      link,
    };
  }

  async revokeAccess(
    cabinetTenantId: string,
    companyTenantId: string,
    actorTenantId: string,
  ) {
    if (actorTenantId !== companyTenantId) {
      throw new ForbiddenException(CabinetMessages.ONLY_COMPANY_CAN_REVOKE);
    }

    const [cabinet, company] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: cabinetTenantId } }),
      this.prisma.tenant.findUnique({ where: { id: companyTenantId } }),
    ]);

    if (!cabinet || cabinet.type !== TenantType.cabinet) {
      throw new BadRequestException(CabinetMessages.INVALID_CABINET);
    }
    if (!company || company.type !== TenantType.company) {
      throw new BadRequestException(CabinetMessages.INVALID_COMPANY);
    }

    const existing = await this.prisma.cabinetCompanyAccess.findUnique({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(CabinetMessages.ACCESS_NOT_FOUND);
    }

    await this.prisma.cabinetCompanyAccess.delete({
      where: { id: existing.id },
    });

    return {
      message: CabinetMessages.ACCESS_REVOKED,
      cabinetTenantId,
      companyTenantId,
    };
  }

  async updateCabinetPermissions(
    cabinetTenantId: string,
    companyTenantId: string,
    actorTenantId: string,
    permissionsInput: string[],
  ) {
    if (actorTenantId !== companyTenantId) {
      throw new ForbiddenException(CabinetMessages.ONLY_COMPANY_CAN_GRANT);
    }

    const permissions = normalizeCabinetLinkPermissions(permissionsInput);

    const existing = await this.prisma.cabinetCompanyAccess.findUnique({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(CabinetMessages.ACCESS_NOT_FOUND);
    }

    const link = await this.prisma.cabinetCompanyAccess.update({
      where: { id: existing.id },
      data: { permissions },
    });

    return {
      message: CabinetMessages.PERMISSIONS_UPDATED,
      link,
      permissions: normalizeCabinetLinkPermissions(link.permissions),
    };
  }

  async listCompanyInvoices(
    cabinetTenantId: string,
    companyTenantId: string,
    page = 1,
    limit = 50,
  ) {
    await this.assertCabinetAccess(
      cabinetTenantId,
      companyTenantId,
      CABINET_SCOPE_PERMISSIONS.INVOICES_READ,
    );

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
    requiredPermission?: CabinetScopePermissionCode,
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
      throw new NotFoundException(CabinetMessages.ACCESS_NOT_AUTHORIZED);
    }

    if (
      requiredPermission &&
      !normalizeCabinetLinkPermissions(link.permissions).includes(
        requiredPermission,
      )
    ) {
      throw new ForbiddenException(CabinetMessages.SCOPE_INVOICES_DENIED);
    }

    return link;
  }
}
