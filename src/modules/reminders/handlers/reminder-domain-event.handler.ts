import { Injectable } from '@nestjs/common';
import { ReminderSentEvent } from '../events/reminder-sent.event';

@Injectable()
export class ReminderDomainEventHandler {
  onReminderSent(event: ReminderSentEvent) {
    console.log(
      '[reminders] sent',
      `level ${event.reminder.level}`,
      event.invoiceNumber,
      event.clientName,
    );
  }
}
