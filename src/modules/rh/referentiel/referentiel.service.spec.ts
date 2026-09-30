import { Test, TestingModule } from '@nestjs/testing';
import { ReferentielService } from './referentiel.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

describe('ReferentielService (Gestion des Barèmes Fiscaux & Simulateur)', () => {
  let service: ReferentielService;
  let prismaMock: any;

  const sampleTranches = [
    { id: 't1', numeroTranche: 1, limiteInferieure: 0, limiteSuperieure: 50000, taux: 0, montantDeductionFixe: 0 },
    { id: 't2', numeroTranche: 2, limiteInferieure: 50000, limiteSuperieure: 130000, taux: 10, montantDeductionFixe: 5000 },
    { id: 't3', numeroTranche: 3, limiteInferieure: 130000, limiteSuperieure: 280000, taux: 15, montantDeductionFixe: 11500 },
    { id: 't4', numeroTranche: 4, limiteInferieure: 280000, limiteSuperieure: 530000, taux: 20, montantDeductionFixe: 25500 },
    { id: 't5', numeroTranche: 5, limiteInferieure: 530000, limiteSuperieure: null, taux: 30, montantDeductionFixe: 78500 },
  ];

  const sampleBaremeIts = {
    id: 'bareme-bj-2026',
    paysCode: 'BJ',
    codeImpot: 'ITS',
    libelle: 'Barème Progressif ITS Bénin 2026 (CGI Art. 125)',
    modeCalcul: 'PROGRESSIF_PAR_TRANCHE',
    periodiciteAssiette: 'MENSUELLE',
    dateDebutValidite: new Date('2026-01-01'),
    dateFinValidite: null,
    tranches: sampleTranches,
  };

  beforeEach(async () => {
    prismaMock = {
      rhPays: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      rhBaremeIts: {
        findMany: jest.fn().mockResolvedValue([sampleBaremeIts]),
        findUnique: jest.fn().mockResolvedValue(sampleBaremeIts),
        findFirst: jest.fn().mockResolvedValue(sampleBaremeIts),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rhBaremeItsTranche: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      rhTauxChargeSociale: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rhBaremeAvantageNature: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rhParametrePays: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferentielService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReferentielService>(ReferentielService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });

  describe('simulateFiscalCalculation (Simulation fiscale et sociale temps réel)', () => {
    it('devrait calculer correctement l’ITS pour un salaire dans la tranche exonérée (<= 50 000)', async () => {
      const result = await service.simulateFiscalCalculation({
        salaireNetImposable: 45000,
        paysCode: 'BJ',
        inclureCnss: false,
        inclureVps: false,
      });

      expect(result.decompositionIts.totalIts).toBe(0);
      expect(result.decompositionIts.tauxEffectifMoyen).toBe(0);
      expect(result.recapitulatif.salaireNetEstime).toBe(45000);
    });

    it('devrait calculer la progressivité sur plusieurs tranches pour 300 000 FCFA net imposable', async () => {
      // 0 à 50 000 : 0 FCFA
      // 50 000 à 130 000 : 80 000 * 10% = 8 000 FCFA
      // 130 000 à 280 000 : 150 000 * 15% = 22 500 FCFA
      // 280 000 à 300 000 : 20 000 * 20% = 4 000 FCFA
      // Total ITS = 0 + 8000 + 22500 + 4000 = 34 500 FCFA
      const result = await service.simulateFiscalCalculation({
        salaireNetImposable: 300000,
        paysCode: 'BJ',
        inclureCnss: false,
        inclureVps: false,
        inclureOrtb: false,
      });

      expect(result.decompositionIts.totalIts).toBe(34500);
      expect(result.decompositionIts.tranches[0].impotTranche).toBe(0);
      expect(result.decompositionIts.tranches[1].impotTranche).toBe(8000);
      expect(result.decompositionIts.tranches[2].impotTranche).toBe(22500);
      expect(result.decompositionIts.tranches[3].impotTranche).toBe(4000);
      expect(result.recapitulatif.salaireNetEstime).toBe(300000 - 34500);
    });

    it('devrait déduire la CNSS salariale (3,6 %) du salaire brut', async () => {
      const brut = 200000;
      // CNSS = 200 000 * 3,6% = 7 200 FCFA
      // Net Imposable = 200 000 - 7 200 = 192 800 FCFA
      const result = await service.simulateFiscalCalculation({
        salaireBrut: brut,
        paysCode: 'BJ',
        inclureCnss: true,
        inclureVps: true,
        tauxVps: 4.0,
      });

      expect(result.cotisationsSalariales.cnss).toBe(7200);
      expect(result.parametres.salaireNetImposable).toBe(192800);
      expect(result.chargesPatronales.vps).toBe(8000); // 200 000 * 4%
      expect(result.chargesPatronales.cnss).toBe(34800); // 200 000 * 17.4%
    });

    it('devrait appliquer la redevance ORTB en mars (1 000 FCFA) et en juin (3 000 FCFA)', async () => {
      // Mars : +1000 FCFA
      const resMars = await service.simulateFiscalCalculation({
        salaireNetImposable: 200000,
        paysCode: 'BJ',
        mois: 3,
        inclureOrtb: true,
      });
      expect(resMars.redevanceOrtb.montant).toBe(1000);

      // Juin pour revenu > 50 000 FCFA : +3000 FCFA
      const resJuin = await service.simulateFiscalCalculation({
        salaireNetImposable: 200000,
        paysCode: 'BJ',
        mois: 6,
        inclureOrtb: true,
      });
      expect(resJuin.redevanceOrtb.montant).toBe(3000);
      expect(resJuin.redevanceOrtb.exoneree).toBe(false);

      // Juin pour revenu <= 50 000 FCFA : EXONÉRÉ selon CGI Art. 125-2
      const resJuinExonere = await service.simulateFiscalCalculation({
        salaireNetImposable: 45000,
        paysCode: 'BJ',
        mois: 6,
        inclureOrtb: true,
      });
      expect(resJuinExonere.redevanceOrtb.montant).toBe(0);
      expect(resJuinExonere.redevanceOrtb.exoneree).toBe(true);
    });
  });
});
