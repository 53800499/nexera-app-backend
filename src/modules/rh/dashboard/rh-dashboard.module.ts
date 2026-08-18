import { Module } from '@nestjs/common';
import { RhDashboardController } from './rh-dashboard.controller';
import { RhDashboardService } from './rh-dashboard.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RhDashboardController],
  providers: [RhDashboardService],
  exports: [RhDashboardService],
})
export class RhDashboardModule {}
