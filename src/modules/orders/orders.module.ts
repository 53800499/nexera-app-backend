import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderEventBus } from './events/order-event-bus';
import { OrderDomainEventHandler } from './handlers/order-domain-event.handler';

@Module({
  imports: [DatabaseModule, InvoicesModule, SettingsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderDomainEventHandler,
    {
      provide: OrderEventBus,
      useFactory: (handler: OrderDomainEventHandler) => {
        const bus = new OrderEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [OrderDomainEventHandler],
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
