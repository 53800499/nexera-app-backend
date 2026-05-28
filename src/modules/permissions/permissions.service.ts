import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePermissionDto) {
    const { code, description } = dto;

    // Vérifier que le code est unique
    const existingPermission = await this.prisma.permission.findUnique({
      where: { code },
    });

    if (existingPermission) {
      throw new BadRequestException('Permission code already exists');
    }

    return this.prisma.permission.create({
      data: {
        code,
        description,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.permission.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const permission = await this.findOne(id);

    // Si le code change, vérifier qu'il est unique
    if (dto.code !== undefined && dto.code !== permission.code) {
      const existingPermission = await this.prisma.permission.findUnique({
        where: { code: dto.code },
      });

      if (existingPermission) {
        throw new BadRequestException('Permission code already exists');
      }
    }

    return this.prisma.permission.update({
      where: { id },
      data: dto,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const permission = await this.findOne(id);

    await this.prisma.permission.delete({
      where: { id },
    });

    return { message: 'Permission deleted successfully' };
  }

  async findByCode(code: string) {
    return this.prisma.permission.findUnique({
      where: { code },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }
}
