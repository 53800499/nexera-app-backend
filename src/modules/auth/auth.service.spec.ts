import { AuthService } from './auth.service';

describe('AuthService.register', () => {
  it('should attach the new user to a tenant role during registration', async () => {
    const tenant = { id: 'tenant-1', name: 'Acme' };
    const role = { id: 'role-1', code: 'OWNER', tenantId: tenant.id };

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue(role),
        create: jest.fn().mockResolvedValue(role),
      },
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === 'user-1') {
            return {
              id: 'user-1',
              email: 'john@acme.test',
              password: 'hashed-password',
              firstName: 'John',
              lastName: 'Doe',
              tenantId: tenant.id,
              isActive: true,
              isSuperAdmin: false,
              roles: [],
            };
          }
          return null;
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'john@acme.test',
          password: 'hashed-password',
          firstName: 'John',
          lastName: 'Doe',
          tenantId: tenant.id,
          isActive: true,
          isSuperAdmin: false,
          roles: [],
        }),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({ id: 'user-role-1' }),
      },
    } as any;

    const jwt = {
      sign: jest.fn().mockReturnValue('token'),
    } as any;

    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback ?? key),
    } as any;

    const service = new AuthService(prisma, jwt, config);

    const result = await service.register({
      email: 'john@acme.test',
      password: '12345678',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: tenant.id,
    } as any);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: tenant.id },
    });
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { tenantId: tenant.id, code: 'OWNER' },
    });
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: role.id },
    });
    expect(result.user.tenantId).toBe(tenant.id);
  });
});
