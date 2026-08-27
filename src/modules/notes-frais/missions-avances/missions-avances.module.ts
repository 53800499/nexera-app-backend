import { Module } from '@nestjs/common';
import { MissionsAvancesService } from './missions-avances.service';
import { MissionsAvancesController } from './missions-avances.controller';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MissionsAvancesController],
  providers: [MissionsAvancesService],
  exports: [MissionsAvancesService],
})
export class MissionsAvancesModule {}
