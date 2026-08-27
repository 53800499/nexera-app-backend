import { Module } from '@nestjs/common';
import { ReferentielNdfService } from './referentiel-ndf.service';
import { ReferentielNdfController } from './referentiel-ndf.controller';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ReferentielNdfController],
  providers: [ReferentielNdfService],
  exports: [ReferentielNdfService],
})
export class ReferentielNdfModule {}
