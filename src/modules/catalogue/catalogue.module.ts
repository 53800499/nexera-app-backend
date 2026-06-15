import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { CatalogueStockEventHandler } from './handlers/catalogue-stock-event.handler';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [CatalogueController],
  providers: [CatalogueService, CatalogueStockEventHandler],
  exports: [CatalogueService],
})
export class CatalogueModule {}
