import { Test, TestingModule } from '@nestjs/testing';
import { ComptaIntegrationEventHandler } from './compta-integration-event.handler';
import { MoteurReglesService } from './moteur-regles.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';

describe('ComptaIntegrationEventHandler - Liaison Fiscalité M7 ➔ Comptabilité M3', () => {
  let handler: ComptaIntegrationEventHandler;
  let moteurReglesMock: any;
  let integrationBusMock: any;
  const subscriptions: Record<string, (event: any) => Promise<void>> = {};

  beforeEach(async () => {
    moteurReglesMock = {
      ingererEvenement: jest.fn().mockResolvedValue({
        evenementId: 'evt-123',
        statut: 'TRAITE',
        ecritureId: 'ecr-123',
      }),
    };

    integrationBusMock = {
      subscribe: jest.fn().mockImplementation((type: string, handlerFn: (event: any) => Promise<void>) => {
        subscriptions[type] = handlerFn;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComptaIntegrationEventHandler,
        { provide: MoteurReglesService, useValue: moteurReglesMock },
        { provide: IntegrationEventBus, useValue: integrationBusMock },
      ],
    }).compile();

    handler = module.get<ComptaIntegrationEventHandler>(ComptaIntegrationEventHandler);
    handler.onModuleInit();
  });

  it('subscribes to all 4 M7 fiscal events upon initialization', () => {
    expect(integrationBusMock.subscribe).toHaveBeenCalledWith(
      'fiscalite.tva.liquidee',
      expect.any(Function),
    );
    expect(integrationBusMock.subscribe).toHaveBeenCalledWith(
      'fiscalite.tva.payee',
      expect.any(Function),
    );
    expect(integrationBusMock.subscribe).toHaveBeenCalledWith(
      'fiscalite.is.valide',
      expect.any(Function),
    );
    expect(integrationBusMock.subscribe).toHaveBeenCalledWith(
      'fiscalite.is.acompte_paye',
      expect.any(Function),
    );
  });

  it('triggers ingererEvenement for M7 when fiscalite.tva.liquidee occurs', async () => {
    const event = {
      type: 'fiscalite.tva.liquidee',
      tenantId: 'tenant-1',
      aggregateId: 'decl-001',
      payload: {
        declarationId: 'decl-001',
        periode: '2026-06',
        codeJournal: 'OD',
        tvaCollectee: 1500000,
        tvaDeductible: 600000,
        tvaNetteDue: 900000,
      },
    };

    await subscriptions['fiscalite.tva.liquidee'](event);

    expect(moteurReglesMock.ingererEvenement).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        moduleSource: 'M7',
        typeEvenement: 'fiscalite.tva.liquidee',
        payload: event.payload,
      }),
      'INTEGRATION_EVENT_BUS',
    );
  });

  it('triggers ingererEvenement for M7 when fiscalite.tva.payee occurs', async () => {
    const event = {
      type: 'fiscalite.tva.payee',
      tenantId: 'tenant-1',
      aggregateId: 'decl-001',
      payload: {
        declarationId: 'decl-001',
        periode: '2026-06',
        montantPaye: 900000,
        modePaiement: 'VIREMENT_BANCAIRE',
      },
    };

    await subscriptions['fiscalite.tva.payee'](event);

    expect(moteurReglesMock.ingererEvenement).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        moduleSource: 'M7',
        typeEvenement: 'fiscalite.tva.payee',
        payload: event.payload,
      }),
      'INTEGRATION_EVENT_BUS',
    );
  });

  it('triggers ingererEvenement for M7 when fiscalite.is.valide occurs', async () => {
    const event = {
      type: 'fiscalite.is.valide',
      tenantId: 'tenant-1',
      aggregateId: 'is-calc-001',
      payload: {
        calculId: 'is-calc-001',
        annee: 2026,
        isNetDu: 2500000,
        resultatFiscal: 10000000,
      },
    };

    await subscriptions['fiscalite.is.valide'](event);

    expect(moteurReglesMock.ingererEvenement).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        moduleSource: 'M7',
        typeEvenement: 'fiscalite.is.valide',
        payload: event.payload,
      }),
      'INTEGRATION_EVENT_BUS',
    );
  });

  it('triggers ingererEvenement for M7 when fiscalite.is.acompte_paye occurs', async () => {
    const event = {
      type: 'fiscalite.is.acompte_paye',
      tenantId: 'tenant-1',
      aggregateId: 'acompte-001',
      payload: {
        acompteId: 'acompte-001',
        numeroAcompte: 1,
        annee: 2026,
        montantPaye: 625000,
      },
    };

    await subscriptions['fiscalite.is.acompte_paye'](event);

    expect(moteurReglesMock.ingererEvenement).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        moduleSource: 'M7',
        typeEvenement: 'fiscalite.is.acompte_paye',
        payload: event.payload,
      }),
      'INTEGRATION_EVENT_BUS',
    );
  });
});
