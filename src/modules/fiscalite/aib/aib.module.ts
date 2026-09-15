import { Module } from '@nestjs/common';
import { AibController } from './aib.controller';
import { AibService } from './aib.service';

@Module({
  controllers: [AibController],
  providers: [AibService],
  exports: [AibService],
})
export class AibModule {}
