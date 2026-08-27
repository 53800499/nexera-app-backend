import { Module } from '@nestjs/common';
import { DepensesService } from './depenses.service';
import { DepensesController } from './depenses.controller';
import { ReferentielNdfModule } from '../referentiel/referentiel-ndf.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule, ReferentielNdfModule],
  controllers: [DepensesController],
  providers: [DepensesService],
  exports: [DepensesService],
})
export class DepensesModule {}
