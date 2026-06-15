import { Module } from '@nestjs/common';
import { StockIntegrationService } from './stock-integration.service';

@Module({
  providers: [StockIntegrationService],
  exports: [StockIntegrationService],
})
export class StockModule {}
