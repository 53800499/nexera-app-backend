import { OrderCreatedEvent } from './order-created.event';
import { OrderUpdatedEvent } from './order-updated.event';
import { OrderConfirmedEvent } from './order-confirmed.event';
import { OrderInvoiceCreatedEvent } from './order-invoice-created.event';
import { OrderDomainEventHandler } from '../handlers/order-domain-event.handler';

export class OrderEventBus {
  private readonly handlers: OrderDomainEventHandler[] = [];

  register(handler: OrderDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof OrderCreatedEvent) handler.onOrderCreated(event);
      if (event instanceof OrderUpdatedEvent) handler.onOrderUpdated(event);
      if (event instanceof OrderConfirmedEvent) handler.onOrderConfirmed(event);
      if (event instanceof OrderInvoiceCreatedEvent) {
        handler.onOrderInvoiceCreated(event);
      }
    }
  }
}
