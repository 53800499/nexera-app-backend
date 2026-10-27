import { Module } from '@nestjs/common';
import { ImpotSocietesController } from './is.controller';
import { ImpotSocietesService } from './is.service';
import { IntegrationEventsModule } from '../../../shared/events/integration-events.module';

@Module({
  imports: [IntegrationEventsModule],
  controllers: [ImpotSocietesController],
  providers: [ImpotSocietesService],
  exports: [ImpotSocietesService],
})
export class ImpotSocietesModule {}
