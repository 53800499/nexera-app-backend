import { Test, TestingModule } from '@nestjs/testing';
import { LiaisonComptaService } from './liaison-compta.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { ImpotSocietesService } from '../is/is.service';
import { TvaService } from '../tva/tva.service';
import { NotFoundException } from '@nestjs/common';

describe('LiaisonComptaService', () => {
  let service: LiaisonComptaService;
  let prismaMock: any;
  let integrationBusMock: any;
  let isServiceMock: any;
  let tvaServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      taxExerciceFiscal: {
        findUnique: jest.fn(),
      },
      comptaExercice: {
        findFirst: jest.fn(),
      },
      comptaEcritureLigne: {
        findMany: jest.fn(),
      },
      comptaLectureResultatExterne: {
        upsert: jest.fn(),
      },
      taxSoldeComptableConsulte: {
        create: jest.fn(),
      },
      taxDeclarationTva: {
        findUnique: jest.fn(),
      },
      comptaJournal: {
        findFirst: jest.fn(),
      },
      comptaEcriture: {
        findFirst: jest.fn(),
      },
    };

    integrationBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    isServiceMock = {
      calculerImpotSocietes: jest.fn(),
    };

    tvaServiceMock = {
      validerDeclaration: jest.fn().mockImplementation(async (id: string) => {
        await integrationBusMock.publish({
          type: 'fiscalite.tva.liquidee',
          aggregateId: id,
          payload: {
            declarationId: id,
            codeJournal: 'OD',
            tvaCollectee: 1800000,
            tvaDeductible: 800000,
            tvaNetteDue: 1000000,
          },
        });
        return { id, statut: 'VALIDEE' };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiaisonComptaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: IntegrationEventBus, useValue: integrationBusMock },
        { provide: ImpotSocietesService, useValue: isServiceMock },
        { provide: TvaService, useValue: tvaServiceMock },
      ],
    }).compile();

    service = module.get<LiaisonComptaService>(LiaisonComptaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDonneesComptablesPourIs', () => {
    it('throws NotFoundException if fiscal exercice does not exist', async () => {
      prismaMock.taxExerciceFiscal.findUnique.mockResolvedValue(null);
      await expect(service.getDonneesComptablesPourIs('invalid-id', 'tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('extracts Net Accounting Result from Class 6 and 7 ledger lines', async () => {
      const mockFiscalEx = {
        id: 'fisc-1',
        dateDebut: new Date('2026-01-01T00:00:00Z'),
        dateFin: new Date('2026-12-31T23:59:59Z'),
        contribuable: { tenantId: 'tenant-1' },
        calculIs: null,
      };
      const mockComptaEx = {
        id: 'compta-ex-1',
        statut: 'OUVERT',
        tenantId: 'tenant-1',
      };

      prismaMock.taxExerciceFiscal.findUnique.mockResolvedValue(mockFiscalEx);
      prismaMock.comptaExercice.findFirst.mockResolvedValue(mockComptaEx);

      // Class 70 lines (Credit 10,000,000)
      // Class 60 lines (Debit 6,000,000)
      prismaMock.comptaEcritureLigne.findMany.mockResolvedValue([
        {
          montantDebit: 0,
          montantCredit: 10000000,
          compte: { numero: '701100', intitule: 'Ventes de marchandises' },
          ecriture: { statut: 'VALIDE', journal: { code: 'VT' } },
        },
        {
          montantDebit: 6000000,
          montantCredit: 0,
          compte: { numero: '601100', intitule: 'Achats de marchandises' },
          ecriture: { statut: 'VALIDE', journal: { code: 'AC' } },
        },
      ]);
      prismaMock.comptaLectureResultatExterne.upsert.mockResolvedValue({});
      prismaMock.taxSoldeComptableConsulte.create.mockResolvedValue({});

      const result = await service.getDonneesComptablesPourIs('fisc-1', 'tenant-1');

      expect(result.exerciceFiscalId).toBe('fisc-1');
      expect(result.exerciceComptableId).toBe('compta-ex-1');
      expect(result.totalProduitsClasse7).toBe(10000000);
      expect(result.totalChargesClasse6).toBe(6000000);
      expect(result.resultatComptableNet).toBe(4000000); // 10M - 6M = 4M
      expect(result.chiffreAffairesClasse70).toBe(10000000);
      expect(result.produitsEncaissables).toBe(10000000);
    });
  });

  describe('getCadrageTva', () => {
    it('compares declared VAT figures with accounted ledger balances', async () => {
      const mockDeclaration = {
        id: 'decl-1',
        periode: '2026-03',
        statut: 'VALIDEE',
        tvaCollecteeTotale: 1800000,
        tvaDeductibleTotale: 800000,
        tvaNetteDue: 1000000,
        baseHorsTaxe: 10000000,
        creditTvaAnterieur: 0,
        contribuable: { tenantId: 'tenant-1' },
      };

      prismaMock.taxDeclarationTva.findUnique.mockResolvedValue(mockDeclaration);

      // Accounted: 4431 = 1,800,000 credit ; 4451 = 800,000 debit ; 701 = 10,000,000 credit
      prismaMock.comptaEcritureLigne.findMany.mockResolvedValue([
        {
          montantDebit: 0,
          montantCredit: 1800000,
          compte: { numero: '443100', intitule: 'TVA facturée' },
          ecriture: { id: 'ecr-1', numero: 'ECR-001', datePiece: new Date('2026-03-15') },
        },
        {
          montantDebit: 800000,
          montantCredit: 0,
          compte: { numero: '445100', intitule: 'TVA récupérable sur achats' },
          ecriture: { id: 'ecr-2', numero: 'ECR-002', datePiece: new Date('2026-03-20') },
        },
        {
          montantDebit: 0,
          montantCredit: 10000000,
          compte: { numero: '701100', intitule: 'Ventes' },
          ecriture: { id: 'ecr-3', numero: 'ECR-003', datePiece: new Date('2026-03-25') },
        },
      ]);
      prismaMock.comptaEcriture.findFirst.mockResolvedValue(null);

      const cadrage = await service.getCadrageTva('decl-1', 'tenant-1');

      expect(cadrage.declarationId).toBe('decl-1');
      expect(cadrage.concordanceGlobale).toBe('CONFORME');
      expect(cadrage.tvaCollecteeDeclaree).toBe(1800000);
      expect(cadrage.tvaCollecteeComptabilisee).toBe(1800000);
      expect(cadrage.ecartTvaCollectee).toBe(0);
      expect(cadrage.tvaDeductibleDeclaree).toBe(800000);
      expect(cadrage.tvaDeductibleComptabilisee).toBe(800000);
      expect(cadrage.ecartTvaDeductible).toBe(0);
      expect(cadrage.tvaNetteDueDeclaree).toBe(1000000);
      expect(cadrage.tvaNetteDueComptabilisee).toBe(1000000);
      expect(cadrage.ecartTvaNetteDue).toBe(0);
    });

    it('flags ECART_DETECTE when there is an anomaly between accounting and tax declaration', async () => {
      const mockDeclaration = {
        id: 'decl-2',
        periode: '2026-04',
        statut: 'BROUILLON',
        tvaCollecteeTotale: 2000000,
        tvaDeductibleTotale: 500000,
        tvaNetteDue: 1500000,
        baseHorsTaxe: 10000000,
        creditTvaAnterieur: 0,
        contribuable: { tenantId: 'tenant-1' },
      };

      prismaMock.taxDeclarationTva.findUnique.mockResolvedValue(mockDeclaration);

      // Accounted: 4431 is 1,800,000 (differs from declared 2,000,000)
      prismaMock.comptaEcritureLigne.findMany.mockResolvedValue([
        {
          montantDebit: 0,
          montantCredit: 1800000,
          compte: { numero: '443100', intitule: 'TVA facturée' },
          ecriture: { id: 'ecr-1', numero: 'ECR-001' },
        },
      ]);
      prismaMock.comptaEcriture.findFirst.mockResolvedValue(null);

      const cadrage = await service.getCadrageTva('decl-2', 'tenant-1');

      expect(cadrage.concordanceGlobale).toBe('ECART_DETECTE');
      expect(cadrage.ecartTvaCollectee).toBe(-200000);
    });
  });

  describe('genererOdLiquidationTva', () => {
    it('publishes fiscalite.tva.liquidee event to generate balanced draft entry in M3', async () => {
      const mockDeclaration = {
        id: 'decl-3',
        periode: '2026-05',
        numeroDeclaration: 'DEC-2026-05-001',
        statut: 'VALIDEE',
        tvaCollecteeTotale: 1800000,
        tvaDeductibleTotale: 800000,
        tvaNetteDue: 1000000,
        creditTvaReportable: 0,
        creditTvaAnterieur: 0,
        contribuable: { tenantId: 'tenant-1' },
      };

      prismaMock.taxDeclarationTva.findUnique.mockResolvedValue(mockDeclaration);

      const res = await service.genererOdLiquidationTva('decl-3', 'tenant-1');

      expect(res.declaration.statut).toBe('VALIDEE');
      expect(integrationBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fiscalite.tva.liquidee',
          aggregateId: 'decl-3',
          payload: expect.objectContaining({
            declarationId: 'decl-3',
            codeJournal: 'OD',
            tvaCollectee: 1800000,
            tvaDeductible: 800000,
            tvaNetteDue: 1000000,
          }),
        }),
      );
    });
  });
});
