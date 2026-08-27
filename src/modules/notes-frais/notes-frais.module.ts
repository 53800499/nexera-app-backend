import { Module } from '@nestjs/common';
import { ReferentielNdfModule } from './referentiel/referentiel-ndf.module';
import { MissionsAvancesModule } from './missions-avances/missions-avances.module';
import { DepensesModule } from './depenses/depenses.module';
import { RapportsFraisModule } from './rapports-frais/rapports-frais.module';
import { IaNdfModule } from './intelligence-artificielle/ia-ndf.module';
import { RemboursementsCartesModule } from './remboursement-cartes/remboursements-cartes.module';
import { NdfDashboardModule } from './dashboard/ndf-dashboard.module';

@Module({
  imports: [
    ReferentielNdfModule,
    MissionsAvancesModule,
    DepensesModule,
    RapportsFraisModule,
    IaNdfModule,
    RemboursementsCartesModule,
    NdfDashboardModule,
  ],
  exports: [
    ReferentielNdfModule,
    MissionsAvancesModule,
    DepensesModule,
    RapportsFraisModule,
    IaNdfModule,
    RemboursementsCartesModule,
    NdfDashboardModule,
  ],
})
export class NotesFraisModule {}
