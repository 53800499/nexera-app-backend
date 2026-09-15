import { Module } from '@nestjs/common';
import { ReferentielFiscalController } from './referentiel-fiscal.controller';
import { ReferentielFiscalService } from './referentiel-fiscal.service';

@Module({
  controllers: [ReferentielFiscalController],
  providers: [ReferentielFiscalService],
  exports: [ReferentielFiscalService],
})
export class ReferentielFiscalModule {}
