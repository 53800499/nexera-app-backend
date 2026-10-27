import { Module, forwardRef } from '@nestjs/common';
import { LiaisonComptaController } from './liaison-compta.controller';
import { LiaisonComptaService } from './liaison-compta.service';
import { IntegrationEventsModule } from '../../../shared/events/integration-events.module';
import { ImpotSocietesModule } from '../is/is.module';
import { TvaModule } from '../tva/tva.module';

@Module({
  imports: [
    IntegrationEventsModule,
    forwardRef(() => ImpotSocietesModule),
    forwardRef(() => TvaModule),
  ],
  controllers: [LiaisonComptaController],
  providers: [LiaisonComptaService],
  exports: [LiaisonComptaService],
})
export class LiaisonComptaModule {}
