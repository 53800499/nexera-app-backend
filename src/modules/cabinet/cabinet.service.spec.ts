import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { CabinetService } from './cabinet.service';
import { CabinetMessages } from './constants/cabinet-messages';

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
});
