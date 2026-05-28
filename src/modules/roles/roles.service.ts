import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const { name, code, description, tenantId, permissionIds } = dto;

    // Vérifier que le code est unique par tenant
    const existingRole = await this.prisma.role.findFirst({
      where: {
        code,
        tenantId,
      },
    });

    if (existingRole) {
      throw new BadRequestException('Role code already exists in this tenant');
    }

    // Créer le rôle
    const role = await this.prisma.role.create({
      data: {
        name,
        code,
        description,
        tenantId,
        permissions: permissionIds
          ? {
              createMany: {
                data: permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return role;
  }

  async findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async update(id: string, tenantId: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id, tenantId);

    // Si le code change, vérifier qu'il est unique
    if (dto.code !== undefined && dto.code !== role.code) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          code: dto.code,
          tenantId,
          NOT: {
            id,
          },
        },
      });

      if (existingRole) {
        throw new BadRequestException(
          'Role code already exists in this tenant',
        );
      }
    }

    const { permissionIds, ...updateData } = dto;

    return this.prisma.role.update({
      where: { id },
      data: {
        ...updateData,
        permissions: permissionIds
          ? {
              deleteMany: {},
              createMany: {
                data: permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const role = await this.findOne(id, tenantId);

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async addPermission(roleId: string, permissionId: string, tenantId: string) {
    const role = await this.findOne(roleId, tenantId);

    // Vérifier que la permission existe
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Vérifier que la relation n'existe pas
    const existingRelation = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (existingRelation) {
      throw new BadRequestException('Permission already assigned to this role');
    }

    await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });

    return this.findOne(roleId, tenantId);
  }

  async removePermission(
    roleId: string,
    permissionId: string,
    tenantId: string,
  ) {
    const role = await this.findOne(roleId, tenantId);

    await this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    return this.findOne(roleId, tenantId);
  }
}
