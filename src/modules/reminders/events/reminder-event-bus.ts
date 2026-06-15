import { ReminderSentEvent } from './reminder-sent.event';
import { ReminderDomainEventHandler } from '../handlers/reminder-domain-event.handler';

export class ReminderEventBus {
  private readonly handlers: ReminderDomainEventHandler[] = [];

  register(handler: ReminderDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof ReminderSentEvent) {
        handler.onReminderSent(event);
      }
    }
  }
}
