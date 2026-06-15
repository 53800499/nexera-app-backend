/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ReminderType } from '../enums/reminder-type.enum';
import { ReminderChannel } from '../enums/reminder-channel.enum';

export class ReminderEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly clientId: string,
    public readonly level: number,
    public readonly type: ReminderType,
    public readonly channel: ReminderChannel,
  ) {}

  static fromPrisma(reminder: any): ReminderEntity {
    return new ReminderEntity(
      reminder.id,
      reminder.tenantId,
      reminder.invoiceId,
      reminder.clientId,
      reminder.level,
      reminder.type as ReminderType,
      reminder.channel as ReminderChannel,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      invoiceId: this.invoiceId,
      clientId: this.clientId,
      level: this.level,
      type: this.type,
      channel: this.channel,
    };
  }
}
