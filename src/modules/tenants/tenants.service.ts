import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: dto.name },
    });

    if (existingTenant) {
      throw new BadRequestException('Tenant name already exists');
    }

    return this.prisma.tenant.create({
      data: { name: dto.name },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    if (dto.name) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: { name: dto.name, NOT: { id } },
      });

      if (existingTenant) {
        throw new BadRequestException('Tenant name already exists');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Tenant deleted successfully' };
  }
}
