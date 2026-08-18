import { Module } from '@nestjs/common';
import { ContratsController } from './contrats.controller';
import { ContratsService } from './contrats.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RhAuditModule } from '../audit/rh-audit.module';

@Module({
  imports: [DatabaseModule, RhAuditModule],
  controllers: [ContratsController],
  providers: [ContratsService],
  exports: [ContratsService],
})
export class ContratsModule {}
