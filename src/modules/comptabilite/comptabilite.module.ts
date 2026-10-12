import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EcrituresController } from './ecritures/ecritures.controller';
import { EcrituresService } from './ecritures/ecritures.service';
import { AuditService } from './etats-financiers/audit.service';
import { EtatsFinanciersController } from './etats-financiers/etats-financiers.controller';
import { EtatsFinanciersService } from './etats-financiers/etats-financiers.service';
import { FecService } from './etats-financiers/fec.service';
import { JournauxExercicesController } from './journaux-exercices/journaux-exercices.controller';
import { JournauxExercicesService } from './journaux-exercices/journaux-exercices.service';
import { LettrageRapprochementController } from './lettrage-rapprochement/lettrage-rapprochement.controller';
import { LettrageRapprochementService } from './lettrage-rapprochement/lettrage-rapprochement.service';
import { MoteurReglesController } from './moteur-regles/moteur-regles.controller';
import { MoteurReglesService } from './moteur-regles/moteur-regles.service';
import { PlanComptableController } from './plan-comptable/plan-comptable.controller';
import { PlanComptableService } from './plan-comptable/plan-comptable.service';
import { RestitutionsController } from './restitutions/restitutions.controller';
import { RestitutionsService } from './restitutions/restitutions.service';
import { ValidationController } from './validation/validation.controller';
import { ValidationService } from './validation/validation.service';

import { ComptaIntegrationEventHandler } from './moteur-regles/compta-integration-event.handler';

@Module({
  imports: [DatabaseModule],
  controllers: [
    PlanComptableController,
    JournauxExercicesController,
    EcrituresController,
    ValidationController,
    RestitutionsController,
    LettrageRapprochementController,
    MoteurReglesController,
    EtatsFinanciersController,
  ],
  providers: [
    PlanComptableService,
    JournauxExercicesService,
    EcrituresService,
    ValidationService,
    RestitutionsService,
    LettrageRapprochementService,
    MoteurReglesService,
    ComptaIntegrationEventHandler,
    EtatsFinanciersService,
    FecService,
    AuditService,
  ],
  exports: [
    PlanComptableService,
    JournauxExercicesService,
    EcrituresService,
    ValidationService,
    RestitutionsService,
    LettrageRapprochementService,
    MoteurReglesService,
    ComptaIntegrationEventHandler,
    EtatsFinanciersService,
    FecService,
    AuditService,
  ],
})
export class ComptabiliteModule {}
