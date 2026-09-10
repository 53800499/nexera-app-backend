import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { ValidationSignatureService } from './validation-signature.service';
import { ValidationSignatureController } from './validation-signature.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ValidationSignatureController],
  providers: [ValidationSignatureService],
  exports: [ValidationSignatureService],
})
export class ValidationSignatureModule {}
