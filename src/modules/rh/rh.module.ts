import { Module } from '@nestjs/common';
import { RhAuditModule } from './audit/rh-audit.module';
import { ReferentielModule } from './referentiel/referentiel.module';
import { OrganisationModule } from './organisation/organisation.module';
import { EmployesModule } from './employes/employes.module';
import { ContratsModule } from './contrats/contrats.module';
import { TempsAbsencesModule } from './temps-absences/temps-absences.module';
import { PaieModule } from './paie/paie.module';
import { InterfacesModule } from './interfaces/interfaces.module';
import { RhDashboardModule } from './dashboard/rh-dashboard.module';

@Module({
  imports: [
    RhAuditModule,
    ReferentielModule,
    OrganisationModule,
    EmployesModule,
    ContratsModule,
    TempsAbsencesModule,
    PaieModule,
    InterfacesModule,
    RhDashboardModule,
  ],
  exports: [
    RhAuditModule,
    ReferentielModule,
    OrganisationModule,
    EmployesModule,
    ContratsModule,
    TempsAbsencesModule,
    PaieModule,
    InterfacesModule,
    RhDashboardModule,
  ],
})
export class RhModule {}
