import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { StockIntegrationService } from './stock-integration.service';
import { StockController } from './stock.controller';
import { StockItemsService } from './stock-items.service';
import { StockMovementsService } from './stock-movements.service';
import { StockExitsService } from './stock-exits.service';
import { WarehousesService } from './warehouses.service';
import { StockInvoiceEventHandler } from './handlers/stock-invoice-event.handler';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [StockController],
  providers: [
    StockIntegrationService,
    StockItemsService,
    StockMovementsService,
    StockExitsService,
    WarehousesService,
    StockInvoiceEventHandler,
  ],
  exports: [
    StockIntegrationService,
    StockItemsService,
    StockMovementsService,
    StockExitsService,
    WarehousesService,
  ],
})
export class StockModule {}
