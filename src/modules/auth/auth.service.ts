import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../shared/interfaces/jwt-payload.interface';
import { SettingsBootstrapService } from '../settings/services/settings-bootstrap.service';
import { AuthMessages } from './constants/auth-messages';

@Injectable()
export class AuthService {
  private readonly defaultPermissions = [
    { code: 'users.read', description: 'View users' },
    { code: 'users.write', description: 'Manage users' },
    { code: 'roles.read', description: 'View roles' },
    { code: 'roles.write', description: 'Manage roles' },
    { code: 'permissions.read', description: 'View permissions' },
    { code: 'permissions.write', description: 'Manage permissions' },
    { code: 'clients.read', description: 'View clients' },
    { code: 'clients.write', description: 'Manage clients' },
    { code: 'quotations.read', description: 'View quotations' },
    { code: 'quotations.write', description: 'Manage quotations' },
    { code: 'manage:users', description: 'Manage users (API guard)' },
    { code: 'manage:roles', description: 'Manage roles (API guard)' },
    { code: 'manage:permissions', description: 'Manage permissions (API guard)' },
    { code: 'manage:tenants', description: 'Manage tenants (API guard)' },
    { code: 'manage:clients', description: 'Manage clients (API guard)' },
    { code: 'manage:quotations', description: 'Manage quotations (API guard)' },
    { code: 'orders.read', description: 'View orders' },
    { code: 'orders.write', description: 'Manage orders' },
    { code: 'manage:orders', description: 'Manage orders (API guard)' },
    { code: 'invoices.read', description: 'View invoices' },
    { code: 'invoices.write', description: 'Manage invoices' },
    { code: 'manage:invoices', description: 'Manage invoices (API guard)' },
    { code: 'payments.read', description: 'View payments' },
    { code: 'payments.write', description: 'Manage payments' },
    { code: 'manage:payments', description: 'Manage payments (API guard)' },
    { code: 'reminders.read', description: 'View reminders' },
    { code: 'reminders.write', description: 'Manage reminders' },
    { code: 'manage:reminders', description: 'Manage reminders (API guard)' },
    { code: 'dashboard.read', description: 'View commercial dashboard' },
    { code: 'settings.read', description: 'View tenant settings' },
    { code: 'manage:settings', description: 'Manage tenant settings (API guard)' },
    { code: 'sync.read', description: 'Pull offline data (bootstrap + delta)' },
    { code: 'sync.push', description: 'Push offline mutations to server' },
  ];

  private readonly defaultRoles = [
    { code: 'ADMIN', name: 'Admin', description: 'Tenant administrator' },
    { code: 'CEO', name: 'CEO', description: 'Founder / CEO' },
  ];
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly settingsBootstrap: SettingsBootstrapService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const { password, firstName, lastName, tenantId, tenantName } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(AuthMessages.EMAIL_ALREADY_EXISTS);
    }

    const tenantNameValue = tenantName?.trim();

    let tenant = tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: tenantId } })
      : null;

    if (!tenant && tenantNameValue) {
      tenant = await this.prisma.tenant.findFirst({
        where: { name: tenantNameValue },
      });
    }

    if (!tenant) {
      if (tenantId && !tenantNameValue) {
        throw new BadRequestException(AuthMessages.TENANT_NOT_FOUND);
      }
      if (!tenantNameValue) {
        throw new BadRequestException(AuthMessages.TENANT_NAME_REQUIRED);
      }

      tenant = await this.prisma.tenant.create({
        data: { name: tenantNameValue },
      });
      await this.settingsBootstrap.seedTenantDefaults(tenant.id);
    }

    await this.seedDefaultRolesAndPermissions(tenant.id);

    const roles = await Promise.all(
      this.defaultRoles.map(async (roleDefinition) => {
        let role = await this.prisma.role.findFirst({
          where: {
            tenantId: tenant.id,
            code: roleDefinition.code,
          },
        });

        if (!role) {
          role = await this.prisma.role.create({
            data: {
              name: roleDefinition.name,
              code: roleDefinition.code,
              description: roleDefinition.description,
              tenantId: tenant.id,
            },
          });
        }

        return role;
      }),
    );

    const firstTenantUser = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        tenantId: tenant.id,
        isActive: true,
        isSuperAdmin: !firstTenantUser,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await Promise.all(
      roles.map((role) =>
        this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        }),
      ),
    );

    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return this.generateTokens(userWithRole);
  }

  private async seedDefaultRolesAndPermissions(tenantId: string) {
    for (const permission of this.defaultPermissions) {
      const existingPermission = await this.prisma.permission.findUnique({
        where: { code: permission.code },
      });

      if (!existingPermission) {
        await this.prisma.permission.create({
          data: permission,
        });
      }
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: this.defaultPermissions.map((permission) => permission.code),
        },
      },
    });

    for (const roleDefinition of this.defaultRoles) {
      let role = await this.prisma.role.findFirst({
        where: {
          tenantId,
          code: roleDefinition.code,
        },
      });

      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: roleDefinition.name,
            code: roleDefinition.code,
            description: roleDefinition.description,
            tenantId,
          },
        });
      }

      await this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  async validateUser(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const { password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(AuthMessages.ACCOUNT_DISABLED);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto);
    return this.generateTokens(user);
  }

  async refreshToken(payload: JwtPayload) {
    // Récupérer l'utilisateur avec ses rôles et permissions actuels
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(AuthMessages.SESSION_EXPIRED);
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: any) {
    // Extraire les rôles et permissions
    const roles = user.roles?.map((ur: any) => ur.role.code) || [];
    const permissions =
      user.roles?.flatMap((ur: any) =>
        ur.role.permissions.map((rp: any) => rp.permission.code),
      ) || [];

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
    };

    const access_token = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRATION', '15m'),
      secret: this.config.get('JWT_SECRET'),
    });

    const refresh_token = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        roles,
        permissions,
      },
    };
  }
}
