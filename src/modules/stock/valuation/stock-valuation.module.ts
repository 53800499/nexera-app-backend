import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { StockValuationController } from './stock-valuation.controller';
import { StockValuationService } from './stock-valuation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StockValuationController],
  providers: [StockValuationService],
  exports: [StockValuationService],
})
export class StockValuationModule {}
