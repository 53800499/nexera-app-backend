import { Global, Module } from '@nestjs/common';
import { IntegrationEventBus } from './integration-event.bus';

@Global()
@Module({
  providers: [IntegrationEventBus],
  exports: [IntegrationEventBus],
})
export class IntegrationEventsModule {}
