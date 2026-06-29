import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CabinetAccessController,
  CabinetController,
} from './cabinet.controller';
import { CabinetService } from './cabinet.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CabinetController, CabinetAccessController],
  providers: [CabinetService],
})
export class CabinetModule {}
