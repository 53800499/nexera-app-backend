import { ReminderEntity } from '../entities/reminder.entity';

export class ReminderSentEvent {
  constructor(
    public readonly reminder: ReminderEntity,
    public readonly invoiceNumber: string,
    public readonly clientName: string,
  ) {}
}
