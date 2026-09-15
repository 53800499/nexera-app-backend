import { Module } from '@nestjs/common';
import { ReferentielFiscalModule } from './referentiel/referentiel-fiscal.module';
import { ContribuableModule } from './contribuable/contribuable.module';
import { ImpotSocietesModule } from './is/is.module';
import { TvaModule } from './tva/tva.module';
import { AibModule } from './aib/aib.module';
import { AutresTaxesModule } from './autres-taxes/autres-taxes.module';
import { LiasseFiscaleModule } from './liasse-fiscale/liasse-fiscale.module';
import { CalendrierFiscalModule } from './calendrier/calendrier-fiscal.module';
import { FecModule } from './fec/fec.module';
import { ControlesContentieuxModule } from './controles/controles-contentieux.module';
import { EvenementsFiscauxModule } from './evenements/evenements-fiscaux.module';
import { FiscaliteDashboardModule } from './dashboard/fiscalite-dashboard.module';

@Module({
  imports: [
    ReferentielFiscalModule,
    ContribuableModule,
    ImpotSocietesModule,
    TvaModule,
    AibModule,
    AutresTaxesModule,
    LiasseFiscaleModule,
    CalendrierFiscalModule,
    FecModule,
    ControlesContentieuxModule,
    EvenementsFiscauxModule,
    FiscaliteDashboardModule,
  ],
  exports: [
    ReferentielFiscalModule,
    ContribuableModule,
    ImpotSocietesModule,
    TvaModule,
    AibModule,
    AutresTaxesModule,
    LiasseFiscaleModule,
    CalendrierFiscalModule,
    FecModule,
    ControlesContentieuxModule,
    EvenementsFiscauxModule,
    FiscaliteDashboardModule,
  ],
})
export class FiscaliteModule {}
