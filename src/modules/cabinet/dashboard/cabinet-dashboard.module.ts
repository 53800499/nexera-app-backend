import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { CabinetDashboardService } from './cabinet-dashboard.service';
import { CabinetDashboardController } from './cabinet-dashboard.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CabinetDashboardController],
  providers: [CabinetDashboardService],
  exports: [CabinetDashboardService],
})
export class CabinetDashboardModule {}
