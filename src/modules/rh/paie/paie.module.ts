import { Module } from '@nestjs/common';
import { PaieController } from './paie.controller';
import { PaieService } from './paie.service';
import { CalculPaieService } from './calcul-paie.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RhAuditModule } from '../audit/rh-audit.module';

@Module({
  imports: [DatabaseModule, RhAuditModule],
  controllers: [PaieController],
  providers: [PaieService, CalculPaieService],
  exports: [PaieService, CalculPaieService],
})
export class PaieModule {}
