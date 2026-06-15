import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientEventBus } from './events/client-event-bus';
import { ClientDomainEventHandler } from './handlers/client-domain-event.handler';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    ClientDomainEventHandler,
    {
      provide: ClientEventBus,
      useFactory: (handler: ClientDomainEventHandler) => {
        const bus = new ClientEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [ClientDomainEventHandler],
    },
  ],
  exports: [ClientsService],
})
export class ClientsModule {}
