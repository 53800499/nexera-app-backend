import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CabinetController } from './cabinet.controller';
import { CabinetService } from './cabinet.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CabinetController],
  providers: [CabinetService],
})
export class CabinetModule {}
