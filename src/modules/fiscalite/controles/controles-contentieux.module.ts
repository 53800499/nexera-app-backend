import { Module } from '@nestjs/common';
import { ControlesContentieuxController } from './controles-contentieux.controller';
import { ControlesContentieuxService } from './controles-contentieux.service';

@Module({
  controllers: [ControlesContentieuxController],
  providers: [ControlesContentieuxService],
  exports: [ControlesContentieuxService],
})
export class ControlesContentieuxModule {}
