import { OrderEntity } from '../entities/order.entity';

export class OrderConfirmedEvent {
  constructor(
    public readonly order: OrderEntity,
    public readonly finalNumber: string,
  ) {}
}
