import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SupervisionService } from './supervision.service';
import { SupervisionController } from './supervision.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [SupervisionController],
  providers: [SupervisionService],
  exports: [SupervisionService],
})
export class SupervisionModule {}
