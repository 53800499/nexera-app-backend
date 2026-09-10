import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { PortefeuilleService } from './portefeuille.service';
import { PortefeuilleController } from './portefeuille.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PortefeuilleController],
  providers: [PortefeuilleService],
  exports: [PortefeuilleService],
})
export class PortefeuilleModule {}
