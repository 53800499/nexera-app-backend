import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantType } from '@prisma/client';
import { generateCabinetInviteCode } from '../cabinet/utils/cabinet-invite.util';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../shared/interfaces/jwt-payload.interface';
import { SettingsBootstrapService } from '../settings/services/settings-bootstrap.service';
import { AuthMessages } from './constants/auth-messages';
import {
  getPermissionCodesForRole,
  getPermissionsForTenantType,
  getRolesForTenantType,
} from '../../shared/constants/tenant-space.constants';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly settingsBootstrap: SettingsBootstrapService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const { password, firstName, lastName, tenantId, tenantName } = dto;
    const requestedType = dto.tenantType ?? TenantType.company;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(AuthMessages.EMAIL_ALREADY_EXISTS);
    }

    const tenantNameValue = tenantName?.trim();

    if (tenantId && dto.tenantType) {
      throw new BadRequestException(AuthMessages.TENANT_TYPE_ON_JOIN_FORBIDDEN);
    }

    let tenant = tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: tenantId } })
      : null;

    if (!tenant && tenantNameValue) {
      tenant = await this.prisma.tenant.findFirst({
        where: { name: tenantNameValue, type: requestedType },
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
        data: {
          name: tenantNameValue,
          type: requestedType,
          cabinetInviteCode:
            requestedType === TenantType.cabinet
              ? generateCabinetInviteCode()
              : undefined,
        },
      });
      await this.settingsBootstrap.seedTenantDefaults(tenant.id);
    }

    await this.seedDefaultRolesAndPermissions(tenant.id, tenant.type);

    const roleDefinitions = getRolesForTenantType(tenant.type);
    const roles = await Promise.all(
      roleDefinitions.map(async (roleDefinition) => {
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
        tenant: true,
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
        tenant: true,
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

    if (!userWithRole) {
      throw new BadRequestException(AuthMessages.PROFILE_NOT_FOUND);
    }

    return this.generateTokens(userWithRole);
  }

  private async seedDefaultRolesAndPermissions(
    tenantId: string,
    tenantType: TenantType,
  ) {
    const permissionDefinitions = getPermissionsForTenantType(tenantType);

    for (const permission of permissionDefinitions) {
      const existingPermission = await this.prisma.permission.findUnique({
        where: { code: permission.code },
      });

      if (!existingPermission) {
        await this.prisma.permission.create({
          data: permission,
        });
      }
    }

    const roleDefinitions = getRolesForTenantType(tenantType);

    for (const roleDefinition of roleDefinitions) {
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

      const permissionCodes = getPermissionCodesForRole(
        roleDefinition.code,
        tenantType,
      );
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

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
        tenant: true,
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
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

  private generateTokens(user: {
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    tenant?: { type: TenantType };
    roles?: Array<{
      role: {
        code: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
  }) {
    const roles = user.roles?.map((ur) => ur.role.code) || [];
    const permissions = [
      ...new Set(
        user.roles?.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code),
        ) || [],
      ),
    ];

    const tenantType = user.tenant?.type ?? TenantType.company;

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      tenantType,
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
        tenantType,
        roles,
        permissions,
      },
    };
  }
}
