import { Module } from '@nestjs/common';
import { AutresTaxesController } from './autres-taxes.controller';
import { AutresTaxesService } from './autres-taxes.service';

@Module({
  controllers: [AutresTaxesController],
  providers: [AutresTaxesService],
  exports: [AutresTaxesService],
})
export class AutresTaxesModule {}
