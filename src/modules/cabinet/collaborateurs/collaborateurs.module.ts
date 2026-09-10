import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { CollaborateursService } from './collaborateurs.service';
import { CollaborateursController } from './collaborateurs.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CollaborateursController],
  providers: [CollaborateursService],
  exports: [CollaborateursService],
})
export class CollaborateursModule {}
