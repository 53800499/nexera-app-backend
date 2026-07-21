import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { StockIntegrationService } from './stock-integration.service';
import { StockController } from './stock.controller';
import { StockItemsService } from './stock-items.service';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StockController],
  providers: [
    StockIntegrationService,
    StockItemsService,
    WarehousesService,
  ],
  exports: [StockIntegrationService, StockItemsService, WarehousesService],
})
export class StockModule {}
