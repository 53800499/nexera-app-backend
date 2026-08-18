import { Module } from '@nestjs/common';
import { EmployesController } from './employes.controller';
import { EmployesService } from './employes.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RhAuditModule } from '../audit/rh-audit.module';

@Module({
  imports: [DatabaseModule, RhAuditModule],
  controllers: [EmployesController],
  providers: [EmployesService],
  exports: [EmployesService],
})
export class EmployesModule {}
