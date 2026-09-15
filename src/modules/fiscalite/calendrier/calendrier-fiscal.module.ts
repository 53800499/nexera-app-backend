import { Module } from '@nestjs/common';
import { CalendrierFiscalController } from './calendrier-fiscal.controller';
import { CalendrierFiscalService } from './calendrier-fiscal.service';

@Module({
  controllers: [CalendrierFiscalController],
  providers: [CalendrierFiscalService],
  exports: [CalendrierFiscalService],
})
export class CalendrierFiscalModule {}
