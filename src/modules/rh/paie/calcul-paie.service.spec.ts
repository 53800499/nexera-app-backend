import { CalculPaieService, ItsBracket, PayrollRubricConfig } from './calcul-paie.service';

describe('CalculPaieService (Moteur de Paie & Fiscalité Dynamique)', () => {
  let service: CalculPaieService;

  const sampleBrackets: ItsBracket[] = [
    { numeroTranche: 1, limiteInferieure: 0, limiteSuperieure: 50000, taux: 0 },
    { numeroTranche: 2, limiteInferieure: 50000, limiteSuperieure: 130000, taux: 10 },
    { numeroTranche: 3, limiteInferieure: 130000, limiteSuperieure: 280000, taux: 15 },
    { numeroTranche: 4, limiteInferieure: 280000, limiteSuperieure: 530000, taux: 20 },
    { numeroTranche: 5, limiteInferieure: 530000, limiteSuperieure: null, taux: 30 },
  ];

  const sampleRubriques: PayrollRubricConfig[] = [
    { code: 'R100', libelle: 'Salaire de Base', typeRubrique: 'GAIN_BRUT', ordreAffichage: 10 },
    { code: 'R110', libelle: 'Heures Supplémentaires', typeRubrique: 'GAIN_BRUT', ordreAffichage: 20 },
    { code: 'R150', libelle: 'Primes et Gratifications', typeRubrique: 'GAIN_BRUT', ordreAffichage: 30 },
    { code: 'R200', libelle: 'Indemnités Non Imposables (Transport)', typeRubrique: 'INDEMNITE_NON_IMPOSABLE', ordreAffichage: 40 },
    { code: 'R300', libelle: 'Avantages en Nature', typeRubrique: 'AVANTAGE_EN_NATURE', ordreAffichage: 50 },
    { code: 'R500', libelle: 'Cotisation CNSS Retraite Salariale', typeRubrique: 'RETENUE_SALARIALE_CNSS', ordreAffichage: 100 },
    { code: 'R600', libelle: 'Cotisations CNSS Patronales', typeRubrique: 'CHARGE_PATRONALE_CNSS', ordreAffichage: 110 },
    { code: 'R550', libelle: 'Impôt sur Traitements et Salaires (ITS)', typeRubrique: 'RETENUE_FISCALE_ITS', ordreAffichage: 120 },
    { code: 'R650', libelle: 'Versement Patronal sur Salaires (VPS)', typeRubrique: 'CHARGE_PATRONALE_VPS', ordreAffichage: 130 },
    { code: 'R700', libelle: 'Retenues Diverses / Avances', typeRubrique: 'RETENUE_NETTE_AUTRE', ordreAffichage: 200 },
    { code: 'R900', libelle: 'Net à Payer', typeRubrique: 'GAIN_NET_NON_IMPOSABLE', ordreAffichage: 999 },
  ];

  beforeEach(() => {
    service = new CalculPaieService();
  });

  describe('calculateIts (Barème ITS dynamique)', () => {
    it('devrait retourner 0 pour un net imposable dans la tranche exonérée (<= 50 000)', () => {
      expect(service.calculateIts(45000, sampleBrackets)).toBe(0);
      expect(service.calculateIts(50000, sampleBrackets)).toBe(0);
    });

    it('devrait calculer 10 % sur la 2e tranche (50 001 à 130 000)', () => {
      expect(service.calculateIts(100000, sampleBrackets)).toBe(5000);
      expect(service.calculateIts(130000, sampleBrackets)).toBe(8000);
    });

    it('devrait calculer 15 % sur la 3e tranche (130 001 à 280 000)', () => {
      expect(service.calculateIts(200000, sampleBrackets)).toBe(18500);
      expect(service.calculateIts(280000, sampleBrackets)).toBe(30500);
    });

    it('devrait calculer 20 % sur la 4e tranche (280 001 à 530 000)', () => {
      expect(service.calculateIts(400000, sampleBrackets)).toBe(54500);
      expect(service.calculateIts(530000, sampleBrackets)).toBe(80500);
    });

    it('devrait calculer 30 % sur la 5e tranche (> 530 000)', () => {
      expect(service.calculateIts(700000, sampleBrackets)).toBe(131500);
    });
  });

  describe('calculateQuotientTax (Méthode du Quotient dynamique)', () => {
    it('devrait calculer l’atténuation d’impôt avec abattement et étalement', () => {
      const salaireOrdinaire = 300000;
      const treiziemeMoisBrut = 300000;
      const res = service.calculateQuotientTax(
        salaireOrdinaire,
        treiziemeMoisBrut,
        25,
        300000,
        sampleBrackets,
      );

      expect(res.salaireMoyenReference12m).toBe(300000);
      expect(res.baseApresAbattement).toBe(225000);
      expect(res.rapportQuotient).toBe(1.75);
      expect(res.impotReference12m).toBe(service.calculateIts(300000, sampleBrackets));
      expect(res.impotSpecifiqueExceptionnel).toBeGreaterThan(0);
    });
  });

  describe('calculatePayslip (Calcul complet d’un bulletin dynamique)', () => {
    it('devrait calculer exactement les cotisations et montants à partir des taux et rubriques de la base', () => {
      const input = {
        salaireBase: 350000,
        heuresNormales: 173.33,
        heuresSup15: 10,
        heuresSup50: 5,
        primesBrutesImposables: 50000,
        indemnitesNonImposables: 25000,
        retenuesDiverses: 10000,
        tauxCnssSalarial: 3.6,
        tauxCnssPatronal: 17.4,
        tauxVpsPatronal: 4.0,
        brackets: sampleBrackets,
        rubriquesCatalogue: sampleRubriques,
      };

      const result = service.calculatePayslip(input);

      expect(result.salaireBase).toBe(350000);
      expect(result.montantHeuresSup).toBeGreaterThan(0);
      expect(result.totalSalaireBrut).toBeGreaterThan(350000);

      // Vérification CNSS
      expect(result.montantCnssSalariale).toBeCloseTo(result.totalAssietteCnss * 0.036, 1);
      expect(result.montantCnssPatronale).toBeCloseTo(result.totalAssietteCnss * 0.174, 1);

      // Vérification VPS (4%)
      expect(result.montantVpsPatronale).toBeCloseTo(result.totalAssietteVps * 0.04, 1);

      // Vérification Net imposable = Assiette - CNSS Salariale
      expect(result.netImposable).toBe(result.totalAssietteCnss - result.montantCnssSalariale);

      // Vérification Net à payer = Brut - Retenues salariales
      expect(result.netAPayer).toBe(result.totalSalaireBrut - result.totalRetenuesSalariales);

      // Vérification des lignes détaillées
      expect(result.detailsLignes.length).toBeGreaterThan(5);
      expect(result.detailsLignes.find((l) => l.codeRubrique === 'R100')).toBeDefined();
      expect(result.detailsLignes.find((l) => l.codeRubrique === 'R500')).toBeDefined();
      expect(result.detailsLignes.find((l) => l.codeRubrique === 'R550')).toBeDefined();
      expect(result.detailsLignes.find((l) => l.codeRubrique === 'R900')).toBeDefined();
    });
  });
});
