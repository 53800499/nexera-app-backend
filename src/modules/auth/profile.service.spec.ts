import * as bcrypt from 'bcrypt';
import { AuthMessages } from './constants/auth-messages';
import { ProfileService } from './profile.service';

jest.mock('bcrypt');

describe('ProfileService', () => {
  const user = {
    id: 'user-1',
    email: 'john@test.com',
    password: 'hashed-old',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: 'tenant-1',
    isActive: true,
    isSuperAdmin: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    tenant: { id: 'tenant-1', name: 'Acme', type: 'company' },
    roles: [
      {
        role: {
          code: 'ADMIN',
          permissions: [{ permission: { code: 'clients.read' } }],
        },
      },
    ],
  };

  const tenantSettings = {
    legalName: 'Acme SARL',
    tradeName: 'Acme',
    primaryCurrency: 'EUR',
    companyEmail: 'contact@acme.com',
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const settingsService = {
    getTenantSettings: jest.fn().mockResolvedValue(tenantSettings),
  };

  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getTenantSettings.mockResolvedValue(tenantSettings);
    service = new ProfileService(prisma as any, settingsService as any);
  });

  it('returns profile with tenant details for active user', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.getProfile('user-1');

    expect(result.email).toBe('john@test.com');
    expect(result.tenant).toEqual({
      id: 'tenant-1',
      name: 'Acme',
      type: 'company',
      legalName: 'Acme SARL',
      tradeName: 'Acme',
      primaryCurrency: 'EUR',
      companyEmail: 'contact@acme.com',
    });
    expect(result.tenantName).toBe('Acme');
    expect(result.roles).toEqual(['ADMIN']);
    expect(result.permissions).toEqual(['clients.read']);
  });

  it('rejects duplicate email on update', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: 'other-user' });

    await expect(
      service.updateProfile('user-1', { email: 'taken@test.com' }),
    ).rejects.toThrow(AuthMessages.EMAIL_ALREADY_USED);
  });

  it('changes password when current password is valid', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');

    const result = await service.changePassword('user-1', {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    });

    expect(result.message).toBe(AuthMessages.PASSWORD_UPDATED);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-new',
        refreshToken: null,
      },
    });
  });

  it('rejects invalid current password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong',
        newPassword: 'NewPass123',
      }),
    ).rejects.toThrow(AuthMessages.CURRENT_PASSWORD_INVALID);
  });
});
