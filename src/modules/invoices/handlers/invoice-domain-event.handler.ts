import { Injectable } from '@nestjs/common';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { InvoiceCreatedEvent } from '../events/invoice-created.event';
import { InvoiceIssuedEvent } from '../events/invoice-issued.event';
import { InvoiceCancelledEvent } from '../events/invoice-cancelled.event';
import { InvoiceSentEvent } from '../events/invoice-sent.event';

@Injectable()
export class InvoiceDomainEventHandler {
  constructor(private readonly integrationBus: IntegrationEventBus) {}

  onInvoiceCreated(event: InvoiceCreatedEvent) {
    console.log('[invoices] created', event.invoice.toResponse());
  }

  onInvoiceIssued(event: InvoiceIssuedEvent) {
    console.log('[invoices] issued', event.invoice.id, event.finalNumber);
    void this.integrationBus.publish({
      eventName: event.eventName,
      tenantId: event.invoice.tenantId,
      occurredAt: event.issueDate,
      payload: {
        invoiceId: event.invoice.id,
        clientId: event.invoice.clientId,
        number: event.finalNumber,
        lines: event.lines,
        issueDate: event.issueDate,
      },
    });
  }

  onInvoiceCancelled(event: InvoiceCancelledEvent) {
    console.log(
      '[invoices] cancelled',
      event.originalInvoice.id,
      'creditNote:',
      event.creditNoteId,
    );
    void this.integrationBus.publish({
      eventName: event.eventName,
      tenantId: event.originalInvoice.tenantId,
      occurredAt: new Date(),
      payload: {
        originalInvoiceId: event.originalInvoice.id,
        creditNoteId: event.creditNoteId,
        amount: event.creditNoteAmount,
      },
    });
  }

  onInvoiceSent(event: InvoiceSentEvent) {
    console.log('[invoices] sent', event.invoice.id, event.recipientEmail);
    void this.integrationBus.publish({
      eventName: event.eventName,
      tenantId: event.invoice.tenantId,
      occurredAt: new Date(),
      payload: {
        invoiceId: event.invoice.id,
        recipientEmail: event.recipientEmail,
      },
    });
  }
}
