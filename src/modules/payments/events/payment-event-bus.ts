import { PaymentRecordedEvent } from './payment-recorded.event';
import { PaymentCancelledEvent } from './payment-cancelled.event';
import { PaymentDomainEventHandler } from '../handlers/payment-domain-event.handler';

export class PaymentEventBus {
  private readonly handlers: PaymentDomainEventHandler[] = [];

  register(handler: PaymentDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof PaymentRecordedEvent) {
        handler.onPaymentRecorded(event);
      }
      if (event instanceof PaymentCancelledEvent) {
        handler.onPaymentCancelled(event);
      }
    }
  }
}
