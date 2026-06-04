import { QuotationCreatedEvent } from './quotation-created.event';
import { QuotationUpdatedEvent } from './quotation-updated.event';
import { QuotationDeletedEvent } from './quotation-deleted.event';
import { QuotationSentEvent } from './quotation-sent.event';
import { QuotationStatusChangedEvent } from './quotation-status-changed.event';
import { QuotationConvertedEvent } from './quotation-converted.event';
import { QuotationDomainEventHandler } from '../handlers/quotation-domain-event.handler';

export class QuotationEventBus {
  private readonly handlers: QuotationDomainEventHandler[] = [];

  register(handler: QuotationDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof QuotationCreatedEvent) {
        handler.onQuotationCreated(event);
      }
      if (event instanceof QuotationUpdatedEvent) {
        handler.onQuotationUpdated(event);
      }
      if (event instanceof QuotationDeletedEvent) {
        handler.onQuotationDeleted(event);
      }
      if (event instanceof QuotationSentEvent) {
        handler.onQuotationSent(event);
      }
      if (event instanceof QuotationStatusChangedEvent) {
        handler.onQuotationStatusChanged(event);
      }
      if (event instanceof QuotationConvertedEvent) {
        handler.onQuotationConverted(event);
      }
    }
  }
}
