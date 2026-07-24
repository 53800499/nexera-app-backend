import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SettingsModule } from '../../settings/settings.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StockIntegrationService } from '../stock-integration.service';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { StockExitsService } from './stock-exits.service';
import { StockInvoiceEventHandler } from './handlers/stock-invoice-event.handler';

@Module({
  imports: [DatabaseModule, SettingsModule, InventoryModule],
  controllers: [StockMovementsController],
  providers: [
    StockMovementsService,
    StockExitsService,
    StockInvoiceEventHandler,
    StockIntegrationService,
  ],
  exports: [StockMovementsService, StockExitsService],
})
export class StockMovementsModule {}
