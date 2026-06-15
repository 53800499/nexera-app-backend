import { OrderEntity } from '../entities/order.entity';

export class OrderUpdatedEvent {
  constructor(public readonly order: OrderEntity) {}
}
