import { OrderEntity } from '../entities/order.entity';

export class OrderCreatedEvent {
  constructor(public readonly order: OrderEntity) {}
}
