import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RemindersModule } from '../reminders/reminders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentEventBus } from './events/payment-event-bus';
import { PaymentDomainEventHandler } from './handlers/payment-domain-event.handler';

@Module({
  imports: [DatabaseModule, RemindersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentDomainEventHandler,
    {
      provide: PaymentEventBus,
      useFactory: (handler: PaymentDomainEventHandler) => {
        const bus = new PaymentEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [PaymentDomainEventHandler],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
