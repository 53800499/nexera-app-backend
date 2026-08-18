import { Module, Global } from '@nestjs/common';
import { RhAuditService } from './rh-audit.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RhAuditService],
  exports: [RhAuditService],
})
export class RhAuditModule {}
