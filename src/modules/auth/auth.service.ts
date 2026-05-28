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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, firstName, lastName, tenantId } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    let role = await this.prisma.role.findFirst({
      where: {
        tenantId,
        code: 'OWNER',
      },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: 'Owner',
          code: 'OWNER',
          description: 'Default tenant owner role',
          tenantId,
        },
      });
    }

    const firstTenantUser = await this.prisma.user.findFirst({
      where: { tenantId },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        tenantId,
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

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

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

  async validateUser(dto: LoginDto) {
    const { email, password } = dto;

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

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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
      throw new UnauthorizedException('User no longer active');
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
