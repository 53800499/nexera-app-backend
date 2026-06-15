import { InvoiceCreatedEvent } from './invoice-created.event';
import { InvoiceIssuedEvent } from './invoice-issued.event';
import { InvoiceCancelledEvent } from './invoice-cancelled.event';
import { InvoiceSentEvent } from './invoice-sent.event';
import { InvoiceDomainEventHandler } from '../handlers/invoice-domain-event.handler';

export class InvoiceEventBus {
  private readonly handlers: InvoiceDomainEventHandler[] = [];

  register(handler: InvoiceDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof InvoiceCreatedEvent) handler.onInvoiceCreated(event);
      if (event instanceof InvoiceIssuedEvent) handler.onInvoiceIssued(event);
      if (event instanceof InvoiceCancelledEvent) {
        handler.onInvoiceCancelled(event);
      }
      if (event instanceof InvoiceSentEvent) handler.onInvoiceSent(event);
    }
  }
}
