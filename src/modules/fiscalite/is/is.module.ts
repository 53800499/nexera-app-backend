import { Module } from '@nestjs/common';
import { ImpotSocietesController } from './is.controller';
import { ImpotSocietesService } from './is.service';

@Module({
  controllers: [ImpotSocietesController],
  providers: [ImpotSocietesService],
  exports: [ImpotSocietesService],
})
export class ImpotSocietesModule {}
