import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL must be set before Prisma can initialize.');
    }

    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  // Helper methods for multi-tenant operations
  async findByTenant<T>(
    model: any,
    tenantId: string,
    where?: any,
  ): Promise<T | null> {
    return model.findFirst({
      where: {
        ...where,
        tenantId,
      },
    });
  }

  async findManyByTenant<T>(
    model: any,
    tenantId: string,
    where?: any,
  ): Promise<T[]> {
    return model.findMany({
      where: {
        ...where,
        tenantId,
      },
    });
  }
}
