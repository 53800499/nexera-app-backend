import { Module } from '@nestjs/common';
import { TvaController } from './tva.controller';
import { TvaService } from './tva.service';
import { IntegrationEventsModule } from '../../../shared/events/integration-events.module';

@Module({
  imports: [IntegrationEventsModule],
  controllers: [TvaController],
  providers: [TvaService],
  exports: [TvaService],
})
export class TvaModule {}
