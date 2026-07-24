import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { StockItemsController } from './stock-items.controller';
import { StockItemsService } from './stock-items.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StockItemsController],
  providers: [StockItemsService],
  exports: [StockItemsService],
})
export class StockItemsModule {}
