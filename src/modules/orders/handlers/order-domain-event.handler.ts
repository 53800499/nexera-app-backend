import { Injectable } from '@nestjs/common';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderUpdatedEvent } from '../events/order-updated.event';
import { OrderConfirmedEvent } from '../events/order-confirmed.event';
import { OrderInvoiceCreatedEvent } from '../events/order-invoice-created.event';

@Injectable()
export class OrderDomainEventHandler {
  onOrderCreated(event: OrderCreatedEvent) {
    console.log('[orders] created', event.order.toResponse());
  }

  onOrderUpdated(event: OrderUpdatedEvent) {
    console.log('[orders] updated', event.order.toResponse());
  }

  onOrderConfirmed(event: OrderConfirmedEvent) {
    console.log(
      '[orders] confirmed',
      event.order.id,
      event.finalNumber,
    );
  }

  onOrderInvoiceCreated(event: OrderInvoiceCreatedEvent) {
    console.log(
      '[orders] invoice created',
      event.order.id,
      event.invoiceId,
      event.amountTtc,
    );
  }
}
