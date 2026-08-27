import { Module } from '@nestjs/common';
import { RemboursementsCartesService } from './remboursements-cartes.service';
import { RemboursementsCartesController } from './remboursements-cartes.controller';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RemboursementsCartesController],
  providers: [RemboursementsCartesService],
  exports: [RemboursementsCartesService],
})
export class RemboursementsCartesModule {}
