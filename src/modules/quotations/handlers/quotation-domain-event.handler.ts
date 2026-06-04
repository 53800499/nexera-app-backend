import { Injectable } from '@nestjs/common';
import { QuotationCreatedEvent } from '../events/quotation-created.event';
import { QuotationUpdatedEvent } from '../events/quotation-updated.event';
import { QuotationDeletedEvent } from '../events/quotation-deleted.event';
import { QuotationSentEvent } from '../events/quotation-sent.event';
import { QuotationStatusChangedEvent } from '../events/quotation-status-changed.event';
import { QuotationConvertedEvent } from '../events/quotation-converted.event';

@Injectable()
export class QuotationDomainEventHandler {
  onQuotationCreated(event: QuotationCreatedEvent) {
    console.log('[quotations] created', event.quotation.toResponse());
  }

  onQuotationUpdated(event: QuotationUpdatedEvent) {
    console.log('[quotations] updated', event.quotation.toResponse());
  }

  onQuotationDeleted(event: QuotationDeletedEvent) {
    console.log('[quotations] deleted', event.quotation.toResponse());
  }

  onQuotationSent(event: QuotationSentEvent) {
    console.log(
      '[quotations] sent',
      event.quotation.toResponse(),
      event.recipientEmail,
    );
  }

  onQuotationStatusChanged(event: QuotationStatusChangedEvent) {
    console.log(
      '[quotations] status',
      event.previousStatus,
      '->',
      event.newStatus,
      event.quotation.id,
    );
  }

  onQuotationConverted(event: QuotationConvertedEvent) {
    console.log(
      '[quotations] converted',
      event.quotation.id,
      event.target,
      event.targetId,
    );
  }
}
