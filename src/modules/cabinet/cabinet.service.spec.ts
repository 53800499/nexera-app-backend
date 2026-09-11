import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { CabinetService } from './cabinet.service';
import { CabinetMessages } from './constants/cabinet-messages';
import { CABINET_SCOPE_PERMISSIONS } from './constants/cabinet-scope.constants';

describe('CabinetService', () => {
  const cabinetId = 'cabinet-1';
  const companyId = 'company-1';
  const linkId = 'link-1';

  const cabinet = { id: cabinetId, name: 'Cabinet Martin', type: TenantType.cabinet };
  const company = { id: companyId, name: 'Acme', type: TenantType.company };

  const buildService = (prisma: Record<string, unknown>) =>
    new CabinetService(prisma as any);

  describe('revokeAccess', () => {
    it('removes an existing cabinet access link', async () => {
      const prisma = {
        tenant: {
          findUnique: jest
            .fn()
            .mockImplementation(async ({ where }: { where: { id: string } }) =>
              where.id === cabinetId ? cabinet : company,
            ),
        },
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue({
            id: linkId,
            cabinetTenantId: cabinetId,
            companyTenantId: companyId,
          }),
          delete: jest.fn().mockResolvedValue({ id: linkId }),
        },
      };

      const service = buildService(prisma);
      const result = await service.revokeAccess(
        cabinetId,
        companyId,
        companyId,
      );

      expect(prisma.cabinetCompanyAccess.delete).toHaveBeenCalledWith({
        where: { id: linkId },
      });
      expect(result).toEqual({
        message: CabinetMessages.ACCESS_REVOKED,
        cabinetTenantId: cabinetId,
        companyTenantId: companyId,
      });
    });

    it('throws when no link exists', async () => {
      const prisma = {
        tenant: {
          findUnique: jest
            .fn()
            .mockImplementation(async ({ where }: { where: { id: string } }) =>
              where.id === cabinetId ? cabinet : company,
            ),
        },
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const service = buildService(prisma);

      await expect(
        service.revokeAccess(cabinetId, companyId, companyId),
      ).rejects.toThrow(new NotFoundException(CabinetMessages.ACCESS_NOT_FOUND));
    });
  });

  describe('grantAccess', () => {
    it('returns message and link on success', async () => {
      const link = {
        id: linkId,
        cabinetTenantId: cabinetId,
        companyTenantId: companyId,
        createdAt: new Date(),
      };

      const prisma = {
        tenant: {
          findUnique: jest
            .fn()
            .mockImplementation(async ({ where }: { where: { id: string } }) =>
              where.id === cabinetId ? cabinet : company,
            ),
        },
        cabinetCompanyAccess: {
          upsert: jest.fn().mockResolvedValue(link),
        },
      };

      const service = buildService(prisma);
      const result = await service.grantAccess(
        cabinetId,
        companyId,
        companyId,
      );

      expect(result).toEqual({
        message: CabinetMessages.ACCESS_GRANTED,
        link,
      });
    });

    it('rejects invalid cabinet tenant', async () => {
      const prisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(company),
        },
      };

      const service = buildService(prisma);

      await expect(
        service.grantAccess('not-a-cabinet', companyId, companyId),
      ).rejects.toThrow(
        new BadRequestException(CabinetMessages.INVALID_CABINET),
      );
    });
  });

  describe('listCompanyPayments', () => {
    it('returns paginated payments when PAYMENTS_READ is granted', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          reference: 'VIR-001',
          paymentDate: new Date('2026-05-10'),
          amount: 1500,
          currency: 'EUR',
          paymentMethod: 'wire',
          isCancelled: false,
          client: { id: 'cli-1', companyName: 'Client 1' },
          imputations: [],
        },
      ];

      const prisma = {
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue({
            id: linkId,
            cabinetTenantId: cabinetId,
            companyTenantId: companyId,
            permissions: [CABINET_SCOPE_PERMISSIONS.PAYMENTS_READ],
          }),
        },
        payment: {
          findMany: jest.fn().mockResolvedValue(mockPayments),
          count: jest.fn().mockResolvedValue(1),
        },
      };

      const service = buildService(prisma);
      const result = await service.listCompanyPayments(cabinetId, companyId, 1, 20);

      expect(result).toEqual({
        items: mockPayments,
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: companyId },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('throws ForbiddenException when PAYMENTS_READ is not granted', async () => {
      const prisma = {
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue({
            id: linkId,
            cabinetTenantId: cabinetId,
            companyTenantId: companyId,
            permissions: [CABINET_SCOPE_PERMISSIONS.INVOICES_READ],
          }),
        },
      };

      const service = buildService(prisma);

      await expect(
        service.listCompanyPayments(cabinetId, companyId, 1, 20),
      ).rejects.toThrow(
        new ForbiddenException(CabinetMessages.SCOPE_PAYMENTS_DENIED),
      );
    });
  });

  describe('listCompanyClients', () => {
    it('returns paginated clients when CLIENTS_READ is granted', async () => {
      const mockClients = [
        {
          id: 'cli-1',
          code: 'CLI-001',
          companyName: 'Acme Client',
          clientType: 'company',
          isArchived: false,
          contacts: [{ id: 'con-1', firstName: 'Alice', isPrimary: true }],
          _count: { invoices: 2, payments: 1 },
        },
      ];

      const prisma = {
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue({
            id: linkId,
            cabinetTenantId: cabinetId,
            companyTenantId: companyId,
            permissions: [CABINET_SCOPE_PERMISSIONS.CLIENTS_READ],
          }),
        },
        client: {
          findMany: jest.fn().mockResolvedValue(mockClients),
          count: jest.fn().mockResolvedValue(1),
        },
      };

      const service = buildService(prisma);
      const result = await service.listCompanyClients(cabinetId, companyId, 1, 20);

      expect(result).toEqual({
        items: mockClients,
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: companyId, deletedAt: null },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('throws ForbiddenException when CLIENTS_READ is not granted', async () => {
      const prisma = {
        cabinetCompanyAccess: {
          findUnique: jest.fn().mockResolvedValue({
            id: linkId,
            cabinetTenantId: cabinetId,
            companyTenantId: companyId,
            permissions: [CABINET_SCOPE_PERMISSIONS.INVOICES_READ],
          }),
        },
      };

      const service = buildService(prisma);

      await expect(
        service.listCompanyClients(cabinetId, companyId, 1, 20),
      ).rejects.toThrow(
        new ForbiddenException(CabinetMessages.SCOPE_CLIENTS_DENIED),
      );
    });
  });
});
