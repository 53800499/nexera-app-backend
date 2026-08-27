import { Module } from '@nestjs/common';
import { IaNdfService } from './ia-ndf.service';
import { IaNdfController } from './ia-ndf.controller';
import { OcrExtractionService } from './ocr-extraction.service';
import { AnomaliesEngineService } from './anomalies-engine.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [IaNdfController],
  providers: [IaNdfService, OcrExtractionService, AnomaliesEngineService],
  exports: [IaNdfService, OcrExtractionService, AnomaliesEngineService],
})
export class IaNdfModule {}
