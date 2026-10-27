import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { MoteurReglesService } from './moteur-regles.service';

/**
 * Gestionnaire d'intégration inter-modules pour la Comptabilité (§6.1 / UC-06).
 * Écoute en temps réel les événements opérationnels émis par :
 * - M1 Ventes / Facturation (invoice.issued, credit_note.issued, invoice.cancelled)
 * - M2 Stocks (stock.inventory_closed, stock.valuation_updated)
 * - M4 RH & Paie (payroll.cycle.validated, rh.payroll.cycle_validated)
 * - M5 Notes de Frais (expense_report.approved, ndf.report_approved)
 * - M7 Paiements & Trésorerie (payment.recorded, payment.received)
 *
 * Crée systématiquement l'événement source dans compta_evenement_source et génère
 * une écriture comptable au statut BROUILLON conforme aux règles SYSCOHADA (EF-019).
 */
@Injectable()
export class ComptaIntegrationEventHandler implements OnModuleInit {
  private readonly logger = new Logger(ComptaIntegrationEventHandler.name);

  constructor(
    private readonly integrationBus: IntegrationEventBus,
    private readonly moteurReglesService: MoteurReglesService,
  ) {}

  onModuleInit() {
    this.logger.log('Initialisation des souscriptions événementielles de comptabilité inter-modules (UC-06)...');

    // 1. M1 Facturation & Ventes
    this.integrationBus.subscribe('invoice.issued', (event) =>
      this.handleEvent('M1', 'invoice.issued', event),
    );
    this.integrationBus.subscribe('credit_note.issued', (event) =>
      this.handleEvent('M1', 'credit_note.issued', event),
    );
    this.integrationBus.subscribe('invoice.cancelled', (event) =>
      this.handleEvent('M1', 'invoice.cancelled', event),
    );

    // 2. M7 Règlements & Trésorerie
    this.integrationBus.subscribe('payment.recorded', (event) =>
      this.handleEvent('M7', 'payment.recorded', event),
    );
    this.integrationBus.subscribe('payment.received', (event) =>
      this.handleEvent('M7', 'payment.received', event),
    );

    // 3. M2 Stocks & Inventaires
    this.integrationBus.subscribe('stock.inventory_closed', (event) =>
      this.handleEvent('M2', 'stock.inventory_closed', event),
    );
    this.integrationBus.subscribe('stock.valuation_updated', (event) =>
      this.handleEvent('M2', 'stock.valuation_updated', event),
    );

    // 4. M4 RH & Paie
    this.integrationBus.subscribe('payroll.cycle.validated', (event) =>
      this.handleEvent('M4', 'payroll.cycle.validated', event),
    );
    this.integrationBus.subscribe('rh.payroll.cycle_validated', (event) =>
      this.handleEvent('M4', 'rh.payroll.cycle_validated', event),
    );

    // 5. M5 Notes de frais & Déplacements
    this.integrationBus.subscribe('expense_report.approved', (event) =>
      this.handleEvent('M5', 'expense_report.approved', event),
    );
    this.integrationBus.subscribe('ndf.report_approved', (event) =>
      this.handleEvent('M5', 'ndf.report_approved', event),
    );

    // 6. M7 Fiscalité (TVA & IS) — Liquidation et Règlements (EF-019 / EF-045)
    this.integrationBus.subscribe('fiscalite.tva.liquidee', (event) =>
      this.handleEvent('M7', 'fiscalite.tva.liquidee', event),
    );
    this.integrationBus.subscribe('fiscalite.tva.payee', (event) =>
      this.handleEvent('M7', 'fiscalite.tva.payee', event),
    );
    this.integrationBus.subscribe('fiscalite.is.valide', (event) =>
      this.handleEvent('M7', 'fiscalite.is.valide', event),
    );
    this.integrationBus.subscribe('fiscalite.is.acompte_paye', (event) =>
      this.handleEvent('M7', 'fiscalite.is.acompte_paye', event),
    );

    this.logger.log('Souscriptions événementielles de comptabilité actives avec succès (M1, M2, M4, M5, M7).');
  }

  private async handleEvent(
    moduleSource: 'M1' | 'M2' | 'M4' | 'M5' | 'M7',
    typeEvenement: string,
    event: any,
  ) {
    const tenantId = event.tenantId;
    if (!tenantId) {
      this.logger.warn(`Événement ${typeEvenement} reçu sans tenantId. Ignoré.`);
      return;
    }

    const payload = event.payload || {};
    const referenceExterne =
      payload.number ||
      payload.invoiceId ||
      payload.paymentId ||
      payload.sessionId ||
      payload.cyclePaieId ||
      payload.rapportFraisId ||
      payload.reference ||
      `EVT-${Date.now()}`;

    try {
      this.logger.log(
        `[${moduleSource}] Ingestion de l'événement ${typeEvenement} (réf: ${referenceExterne}) pour tenant ${tenantId}...`,
      );

      const res = await this.moteurReglesService.ingererEvenement(
        tenantId,
        {
          moduleSource,
          typeEvenement,
          referenceExterne: String(referenceExterne),
          payload,
        },
        'INTEGRATION_EVENT_BUS',
      );

      if (res.statut === 'TRAITE') {
        this.logger.log(
          `[${moduleSource}] Événement ${typeEvenement} comptabilisé avec succès. Écriture BROUILLON id=${res.ecritureId}`,
        );
      } else {
        this.logger.warn(
          `[${moduleSource}] Événement ${typeEvenement} enregistré en ANOMALIE: ${res.erreur}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Erreur critique lors du traitement de l'événement ${typeEvenement} : ${err.message}`,
        err.stack,
      );
    }
  }
}
