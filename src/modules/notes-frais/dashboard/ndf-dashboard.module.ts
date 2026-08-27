import { Module } from '@nestjs/common';
import { NdfDashboardService } from './ndf-dashboard.service';
import { NdfDashboardController } from './ndf-dashboard.controller';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [NdfDashboardController],
  providers: [NdfDashboardService],
  exports: [NdfDashboardService],
})
export class NdfDashboardModule {}
