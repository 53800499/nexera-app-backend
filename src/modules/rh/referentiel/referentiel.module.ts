import { Module } from '@nestjs/common';
import { ReferentielController } from './referentiel.controller';
import { ReferentielService } from './referentiel.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ReferentielController],
  providers: [ReferentielService],
  exports: [ReferentielService],
})
export class ReferentielModule {}
