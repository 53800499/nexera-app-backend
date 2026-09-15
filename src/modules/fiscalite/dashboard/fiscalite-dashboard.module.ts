import { Module } from '@nestjs/common';
import { FiscaliteDashboardController } from './fiscalite-dashboard.controller';
import { FiscaliteDashboardService } from './fiscalite-dashboard.service';

@Module({
  controllers: [FiscaliteDashboardController],
  providers: [FiscaliteDashboardService],
  exports: [FiscaliteDashboardService],
})
export class FiscaliteDashboardModule {}
