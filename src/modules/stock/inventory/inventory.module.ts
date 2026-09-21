import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SettingsModule } from '../../settings/settings.module';
import { StockIntegrationService } from '../stock-integration.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryFreezeGuard } from './inventory-freeze.guard';
import { InventoryPdfService } from './inventory-pdf.service';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryFreezeGuard,
    StockIntegrationService,
    InventoryPdfService,
  ],
  exports: [InventoryService, InventoryFreezeGuard, InventoryPdfService],
})
export class InventoryModule {}
