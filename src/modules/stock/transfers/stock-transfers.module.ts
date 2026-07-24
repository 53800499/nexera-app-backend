import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SettingsModule } from '../../settings/settings.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StockIntegrationService } from '../stock-integration.service';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';

@Module({
  imports: [DatabaseModule, SettingsModule, InventoryModule],
  controllers: [StockTransfersController],
  providers: [StockTransfersService, StockIntegrationService],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}
