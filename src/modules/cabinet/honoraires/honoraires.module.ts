import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { HonorairesService } from './honoraires.service';
import { HonorairesController } from './honoraires.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HonorairesController],
  providers: [HonorairesService],
  exports: [HonorairesService],
})
export class HonorairesModule {}
