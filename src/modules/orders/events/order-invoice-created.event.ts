import { OrderEntity } from '../entities/order.entity';

export class OrderInvoiceCreatedEvent {
  constructor(
    public readonly order: OrderEntity,
    public readonly invoiceId: string,
    public readonly amountTtc: number,
  ) {}
}
