import { Injectable } from '@nestjs/common';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { PaymentRecordedEvent } from '../events/payment-recorded.event';
import { PaymentCancelledEvent } from '../events/payment-cancelled.event';

@Injectable()
export class PaymentDomainEventHandler {
  constructor(private readonly integrationBus: IntegrationEventBus) {}

  onPaymentRecorded(event: PaymentRecordedEvent) {
    console.log(
      '[payments] recorded',
      event.payment.toResponse(),
      'allocations:',
      event.allocations.length,
      'advance:',
      event.advanceAmount,
    );
    void this.integrationBus.publish({
      eventName: event.eventName,
      tenantId: event.payment.tenantId,
      occurredAt: new Date(),
      payload: {
        paymentId: event.payment.id,
        invoiceIds: event.allocations.map((a) => a.invoiceId),
        amounts: event.allocations,
        paymentMethod: event.payment.paymentMethod,
      },
    });
  }

  onPaymentCancelled(event: PaymentCancelledEvent) {
    console.log(
      '[payments] cancelled',
      event.payment.id,
      'reason:',
      event.reason,
    );
    void this.integrationBus.publish({
      eventName: event.eventName,
      tenantId: event.payment.tenantId,
      occurredAt: new Date(),
      payload: {
        paymentId: event.payment.id,
        reason: event.reason,
      },
    });
  }
}
