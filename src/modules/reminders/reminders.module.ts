import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';
import { ReminderNotificationService } from './services/reminder-notification.service';
import { PaymentBehaviorAnalysisService } from './services/payment-behavior-analysis.service';
import { ReminderEventBus } from './events/reminder-event-bus';
import { ReminderDomainEventHandler } from './handlers/reminder-domain-event.handler';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    RemindersScheduler,
    ReminderNotificationService,
    PaymentBehaviorAnalysisService,
    ReminderDomainEventHandler,
    {
      provide: ReminderEventBus,
      useFactory: (handler: ReminderDomainEventHandler) => {
        const bus = new ReminderEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [ReminderDomainEventHandler],
    },
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
