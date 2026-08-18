import { Module } from '@nestjs/common';
import { TempsAbsencesController } from './temps-absences.controller';
import { TempsAbsencesService } from './temps-absences.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RhAuditModule } from '../audit/rh-audit.module';

@Module({
  imports: [DatabaseModule, RhAuditModule],
  controllers: [TempsAbsencesController],
  providers: [TempsAbsencesService],
  exports: [TempsAbsencesService],
})
export class TempsAbsencesModule {}
