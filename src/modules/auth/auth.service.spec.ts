import { AuthService } from './auth.service';
import { AuthMessages } from './constants/auth-messages';

describe('AuthService.register', () => {
  it('should create a tenant and seed default roles/permissions during company registration', async () => {
    const tenant = { id: 'tenant-1', name: 'Acme' };

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(tenant),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.code === 'ADMIN' ? 'role-admin' : 'role-ceo',
          ...data,
        })),
      },
      permission: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { id: 'perm-1', code: 'users.read' },
          { id: 'perm-2', code: 'users.write' },
          { id: 'perm-3', code: 'roles.read' },
          { id: 'perm-4', code: 'roles.write' },
          { id: 'perm-5', code: 'permissions.read' },
          { id: 'perm-6', code: 'permissions.write' },
          { id: 'perm-7', code: 'clients.read' },
          { id: 'perm-8', code: 'clients.write' },
          { id: 'perm-9', code: 'quotations.read' },
          { id: 'perm-10', code: 'quotations.write' },
          { id: 'perm-11', code: 'manage:quotations' },
        ]),
        create: jest
          .fn()
          .mockImplementation(async ({ data }) => ({ id: data.code, ...data })),
      },
      rolePermission: {
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
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
              isSuperAdmin: true,
              roles: [
                {
                  role: {
                    code: 'ADMIN',
                    permissions: [],
                  },
                },
              ],
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
          isSuperAdmin: true,
          roles: [],
        }),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({ id: 'user-role-1' }),
      },
    } as any;

    const jwt = { sign: jest.fn().mockReturnValue('token') } as any;
    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback ?? key),
    } as any;

    const service = new AuthService(prisma, jwt, config, {
      seedTenantDefaults: jest.fn().mockResolvedValue(undefined),
    } as any);

    const result = await service.register({
      email: 'john@acme.test',
      password: '12345678',
      firstName: 'John',
      lastName: 'Doe',
      tenantName: 'Acme',
    } as any);

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme' },
    });
    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: tenant.id, code: 'ADMIN' }),
      }),
    );
    expect(prisma.rolePermission.createMany).toHaveBeenCalled();
    expect(prisma.userRole.create).toHaveBeenCalled();
    expect(result.user.tenantId).toBe(tenant.id);
  });

  it('should attach the new user to a tenant role during registration', async () => {
    const tenant = { id: 'tenant-1', name: 'Acme' };
    const role = { id: 'role-1', code: 'OWNER', tenantId: tenant.id };

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue(role),
        create: jest.fn().mockResolvedValue(role),
      },
      permission: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      rolePermission: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
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

    const service = new AuthService(prisma, jwt, config, {
      seedTenantDefaults: jest.fn().mockResolvedValue(undefined),
    } as any);

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
    expect(prisma.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenant.id, code: 'ADMIN' }),
      }),
    );
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: role.id },
    });
    expect(result.user.tenantId).toBe(tenant.id);
  });

  it('rejects duplicate email with a clear message', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-user' }),
      },
    } as any;

    const service = new AuthService(
      prisma,
      {} as any,
      {} as any,
      { seedTenantDefaults: jest.fn() } as any,
    );

    await expect(
      service.register({
        email: 'john@acme.test',
        password: '12345678',
        firstName: 'John',
        lastName: 'Doe',
        tenantName: 'Acme',
      } as any),
    ).rejects.toThrow(AuthMessages.EMAIL_ALREADY_EXISTS);
  });

  it('rejects registration without tenant name', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;

    const service = new AuthService(
      prisma,
      {} as any,
      {} as any,
      { seedTenantDefaults: jest.fn() } as any,
    );

    await expect(
      service.register({
        email: 'john@acme.test',
        password: '12345678',
        firstName: 'John',
        lastName: 'Doe',
      } as any),
    ).rejects.toThrow(AuthMessages.TENANT_NAME_REQUIRED);
  });
});

describe('AuthService.login', () => {
  const buildService = (user: any) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    } as any;

    return new AuthService(
      prisma,
      { sign: jest.fn().mockReturnValue('token') } as any,
      { get: jest.fn((_, fallback) => fallback) } as any,
      { seedTenantDefaults: jest.fn() } as any,
    );
  };

  it('rejects unknown email with a clear message', async () => {
    const service = buildService(null);

    await expect(
      service.login({ email: 'unknown@test.com', password: '12345678' }),
    ).rejects.toThrow(AuthMessages.INVALID_CREDENTIALS);
  });

  it('rejects disabled account with a clear message', async () => {
    const service = buildService({
      id: 'user-1',
      email: 'john@test.com',
      password: '$2b$10$invalid',
      isActive: false,
      roles: [],
    });

    await expect(
      service.login({ email: 'john@test.com', password: '12345678' }),
    ).rejects.toThrow(AuthMessages.ACCOUNT_DISABLED);
  });
});
