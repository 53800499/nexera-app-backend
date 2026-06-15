/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { OrderStatus } from '../enums/order-status.enum';

export class OrderEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly number: string,
    public readonly clientId: string,
    public readonly status: OrderStatus,
    public readonly totalTtc: number,
    public readonly quotationId: string | null,
  ) {}

  static fromPrisma(order: any): OrderEntity {
    return new OrderEntity(
      order.id,
      order.tenantId,
      order.number,
      order.clientId,
      order.status as OrderStatus,
      order.totalTtc,
      order.quotationId ?? null,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      number: this.number,
      clientId: this.clientId,
      status: this.status,
      totalTtc: this.totalTtc,
      quotationId: this.quotationId,
    };
  }
}
