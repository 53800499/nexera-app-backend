import { Module } from '@nestjs/common';
import { EvenementsFiscauxService } from './evenements-fiscaux.service';
import { IntegrationEventsModule } from '../../../shared/events/integration-events.module';

@Module({
  imports: [IntegrationEventsModule],
  providers: [EvenementsFiscauxService],
  exports: [EvenementsFiscauxService],
})
export class EvenementsFiscauxModule {}

