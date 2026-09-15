import { Module } from '@nestjs/common';
import { ContribuableController } from './contribuable.controller';
import { ContribuableService } from './contribuable.service';

@Module({
  controllers: [ContribuableController],
  providers: [ContribuableService],
  exports: [ContribuableService],
})
export class ContribuableModule {}
