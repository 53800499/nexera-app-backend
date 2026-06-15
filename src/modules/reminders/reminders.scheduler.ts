import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly remindersService: RemindersService) {}

  /** UC-07 — chaque jour à 07:00 UTC : relances automatiques J+3 / J+15 / J+30 */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyReminders() {
    this.logger.log('Starting automatic reminders job');
    const result = await this.remindersService.processAutomaticReminders();
    this.logger.log(
      `Reminders job done: ${result.processed} checked, ${result.sent} sent, ${result.skipped} skipped, ${result.blocked} blocked`,
    );
  }
}
