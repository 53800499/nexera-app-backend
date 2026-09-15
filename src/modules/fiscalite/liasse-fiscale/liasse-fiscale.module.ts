import { Module } from '@nestjs/common';
import { LiasseFiscaleController } from './liasse-fiscale.controller';
import { LiasseFiscaleService } from './liasse-fiscale.service';

@Module({
  controllers: [LiasseFiscaleController],
  providers: [LiasseFiscaleService],
  exports: [LiasseFiscaleService],
})
export class LiasseFiscaleModule {}
