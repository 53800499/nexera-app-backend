import { Module } from '@nestjs/common';
import { StockIntegrationService } from './stock-integration.service';
import { StockItemsModule } from './items/stock-items.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { StockMovementsModule } from './movements/stock-movements.module';
import { StockTransfersModule } from './transfers/stock-transfers.module';
import { InventoryModule } from './inventory/inventory.module';
import { StockAlertsModule } from './alerts/stock-alerts.module';
import { StockValuationModule } from './valuation/stock-valuation.module';

@Module({
  imports: [
    StockItemsModule,
    WarehousesModule,
    StockMovementsModule,
    StockTransfersModule,
    InventoryModule,
    StockAlertsModule,
    StockValuationModule,
  ],
  providers: [StockIntegrationService],
  exports: [
    StockIntegrationService,
    StockItemsModule,
    WarehousesModule,
    StockMovementsModule,
    StockTransfersModule,
    InventoryModule,
    StockAlertsModule,
    StockValuationModule,
  ],
})
export class StockModule {}
