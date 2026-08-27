import { Module } from '@nestjs/common';
import { RapportsFraisService } from './rapports-frais.service';
import { RapportsFraisController } from './rapports-frais.controller';
import { IaNdfModule } from '../intelligence-artificielle/ia-ndf.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule, IaNdfModule],
  controllers: [RapportsFraisController],
  providers: [RapportsFraisService],
  exports: [RapportsFraisService],
})
export class RapportsFraisModule {}
