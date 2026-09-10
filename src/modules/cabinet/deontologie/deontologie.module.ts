import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { DeontologieService } from './deontologie.service';
import { DeontologieController } from './deontologie.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DeontologieController],
  providers: [DeontologieService],
  exports: [DeontologieService],
})
export class DeontologieModule {}
