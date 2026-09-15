import { Module } from '@nestjs/common';
import { EvenementsFiscauxService } from './evenements-fiscaux.service';

@Module({
  providers: [EvenementsFiscauxService],
  exports: [EvenementsFiscauxService],
})
export class EvenementsFiscauxModule {}
