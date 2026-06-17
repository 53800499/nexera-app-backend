import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserInvitationService } from '../auth/user-invitation.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-role.dto';
import { UserEventBus } from './events/user-event-bus';
import { UserCreatedEvent } from './events/user-created.event';
import { UserUpdatedEvent } from './events/user-updated.event';
import { UserStatusChangedEvent } from './events/user-status-changed.event';
import { UserRolesAssignedEvent } from './events/user-roles-assigned.event';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly userEventBus: UserEventBus,
    private readonly userInvitation: UserInvitationService,
  ) {}

  private userInclude = {
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
  };

  async create(dto: CreateUserDto, tenantId: string) {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const targetTenantId = dto.tenantId || tenantId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: targetTenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const plainPassword =
      dto.password?.trim() || this.userInvitation.resolveDefaultPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const requestPasswordReset = dto.requestPasswordReset ?? false;

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        tenantId: targetTenantId,
        isActive: dto.isActive ?? true,
      },
      include: this.userInclude,
    });

    this.userEventBus.publish(
      new UserCreatedEvent(UserEntity.fromPrisma(user)),
    );

    const invitation = await this.userInvitation.sendNewUserInvitation({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      },
      tenantName: tenant.name,
      initialPassword: plainPassword,
      requestPasswordReset,
    });

    let result = this.omitPassword(user);

    if (dto.roleIds?.length) {
      await this.assignRolesInternal(user.id, dto.roleIds, targetTenantId);
      result = this.omitPassword(await this.findOne(user.id, targetTenantId));
    }

    return {
      ...result,
      invitation,
    };
  }

  private omitPassword<T extends { password?: string }>(user: T) {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      include: this.userInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });

    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const user = await this.findOne(id, tenantId);

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException('Email already used');
      }
    }

    const data: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ? dto.email.toLowerCase().trim() : undefined,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key],
    );

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: this.userInclude,
    });

    this.userEventBus.publish(
      new UserUpdatedEvent(UserEntity.fromPrisma(updated)),
    );

    return updated;
  }

  async remove(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    this.userEventBus.publish(
      new UserStatusChangedEvent(
        UserEntity.fromPrisma({ ...user, isActive: false }),
        false,
      ),
    );

    return {
      message: 'User disabled successfully',
      userId: user.id,
      tenantId,
    };
  }

  async toggleStatus(id: string, tenantId: string, isActive: boolean) {
    const user = await this.findOne(id, tenantId);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: this.userInclude,
    });

    this.userEventBus.publish(
      new UserStatusChangedEvent(UserEntity.fromPrisma(updated), isActive),
    );

    return updated;
  }

  async assignRoles(id: string, tenantId: string, dto: AssignRolesDto) {
    await this.findOne(id, tenantId);
    await this.assignRolesInternal(id, dto.roleIds, tenantId);

    const updatedUser = await this.findOne(id, tenantId);
    this.userEventBus.publish(
      new UserRolesAssignedEvent(
        UserEntity.fromPrisma(updatedUser),
        dto.roleIds,
      ),
    );

    return updatedUser;
  }

  private async assignRolesInternal(
    userId: string,
    roleIds: string[],
    tenantId: string,
  ) {
    for (const roleId of roleIds) {
      const role = await this.prisma.role.findFirst({
        where: { id: roleId, tenantId },
      });

      if (!role) {
        throw new NotFoundException('Role not found in this tenant');
      }

      const existing = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
      });

      if (!existing) {
        await this.prisma.userRole.create({
          data: { userId, roleId },
        });
      }
    }
  }

  async removeRole(userId: string, roleId: string, tenantId: string) {
    await this.findOne(userId, tenantId);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found in this tenant');
    }

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    return this.findOne(userId, tenantId);
  }

  async permissions(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);

    const permissions = new Set<string>();

    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      permissions: Array.from(permissions).sort(),
      roles: user.roles.map((ur) => ur.role.code),
    };
  }
}
