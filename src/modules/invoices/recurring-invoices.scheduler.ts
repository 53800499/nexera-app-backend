import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringInvoicesService } from './recurring-invoices.service';

@Injectable()
export class RecurringInvoicesScheduler {
  private readonly logger = new Logger(RecurringInvoicesScheduler.name);

  constructor(
    private readonly recurringInvoicesService: RecurringInvoicesService,
  ) {}

  /** RM-F08 — chaque jour à 06:00 UTC : génération J-7 + avancement des cycles */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyGeneration() {
    this.logger.log('Starting recurring invoice daily job');
    const result = await this.recurringInvoicesService.processAllDue();
    this.logger.log(
      `Recurring job done: ${result.processed} checked, ${result.generated} generated, ${result.advanced} advanced`,
    );
  }
}
