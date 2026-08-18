import { Module } from '@nestjs/common';
import { InterfacesController } from './interfaces.controller';
import { InterfacesService } from './interfaces.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RhAuditModule } from '../audit/rh-audit.module';

@Module({
  imports: [DatabaseModule, RhAuditModule],
  controllers: [InterfacesController],
  providers: [InterfacesService],
  exports: [InterfacesService],
})
export class InterfacesModule {}
