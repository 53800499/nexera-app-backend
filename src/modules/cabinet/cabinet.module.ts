import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CabinetAccessController,
  CabinetController,
} from './cabinet.controller';
import { CabinetService } from './cabinet.service';
import { PortefeuilleModule } from './portefeuille/portefeuille.module';
import { CollaborateursModule } from './collaborateurs/collaborateurs.module';
import { MissionsModule } from './missions/missions.module';
import { SupervisionModule } from './supervision/supervision.module';
import { ValidationSignatureModule } from './validation-signature/validation-signature.module';
import { HonorairesModule } from './honoraires/honoraires.module';
import { CommunicationModule } from './communication/communication.module';
import { DeontologieModule } from './deontologie/deontologie.module';
import { CabinetDashboardModule } from './dashboard/cabinet-dashboard.module';

@Module({
  imports: [
    DatabaseModule,
    PortefeuilleModule,
    CollaborateursModule,
    MissionsModule,
    SupervisionModule,
    ValidationSignatureModule,
    HonorairesModule,
    CommunicationModule,
    DeontologieModule,
    CabinetDashboardModule,
  ],
  controllers: [CabinetController, CabinetAccessController],
  providers: [CabinetService],
  exports: [
    CabinetService,
    PortefeuilleModule,
    CollaborateursModule,
    MissionsModule,
    SupervisionModule,
    ValidationSignatureModule,
    HonorairesModule,
    CommunicationModule,
    DeontologieModule,
    CabinetDashboardModule,
  ],
})
export class CabinetModule {}
