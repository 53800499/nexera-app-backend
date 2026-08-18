import { CalculPaieService } from './calcul-paie.service';

describe('CalculPaieService (Moteur de Paie & Fiscalité Bénin CGI 2026)', () => {
  let service: CalculPaieService;

  beforeEach(() => {
    service = new CalculPaieService();
  });

  describe('calculateIts (Barème ITS Bénin CGI 2026 Art. 125)', () => {
    it('devrait retourner 0 FCFA pour un net imposable <= 50 000 FCFA', () => {
      expect(service.calculateIts(45000)).toBe(0);
      expect(service.calculateIts(50000)).toBe(0);
    });

    it('devrait calculer 10 % sur la 2e tranche (50 001 à 130 000 FCFA)', () => {
      // 100 000 FCFA: (100 000 - 50 000) * 10% = 5 000 FCFA
      expect(service.calculateIts(100000)).toBe(5000);
      // 130 000 FCFA: (130 000 - 50 000) * 10% = 8 000 FCFA
      expect(service.calculateIts(130000)).toBe(8000);
    });

    it('devrait calculer 15 % sur la 3e tranche (130 001 à 280 000 FCFA)', () => {
      // 200 000 FCFA: 8 000 + (200 000 - 130 000) * 15% = 8 000 + 10 500 = 18 500 FCFA
      expect(service.calculateIts(200000)).toBe(18500);
      // 280 000 FCFA: 8 000 + 150 000 * 15% = 8 000 + 22 500 = 30 500 FCFA
      expect(service.calculateIts(280000)).toBe(30500);
    });

    it('devrait calculer 20 % sur la 4e tranche (280 001 à 530 000 FCFA)', () => {
      // 400 000 FCFA: 30 500 + (400 000 - 280 000) * 20% = 30 500 + 24 000 = 54 500 FCFA
      expect(service.calculateIts(400000)).toBe(54500);
      // 530 000 FCFA: 30 500 + 250 000 * 20% = 30 500 + 50 000 = 80 500 FCFA
      expect(service.calculateIts(530000)).toBe(80500);
    });

    it('devrait calculer 30 % sur la 5e tranche (> 530 000 FCFA)', () => {
      // 700 000 FCFA: 80 500 + (700 000 - 530 000) * 30% = 80 500 + 51 000 = 131 500 FCFA
      expect(service.calculateIts(700000)).toBe(131500);
    });
  });

  describe('calculateQuotientTax (Méthode du Quotient - Art. 126 CGI Bénin 2026)', () => {
    it('devrait calculer l’atténuation d’impôt avec abattement de 25% et lissage sur 12 mois', () => {
      const salaireOrdinaire = 300000;
      const treiziemeMoisBrut = 300000;
      const res = service.calculateQuotientTax(salaireOrdinaire, treiziemeMoisBrut, 25, 300000);

      expect(res.salaireMoyenReference12m).toBe(300000);
      expect(res.baseApresAbattement).toBe(225000); // 300 000 * 0.75
      expect(res.rapportQuotient).toBe(1.75); // (300 000 + 225 000) / 300 000 = 1.75
      expect(res.impotReference12m).toBe(service.calculateIts(300000));
      expect(res.impotSpecifiqueExceptionnel).toBeGreaterThan(0);
    });
  });

  describe('calculatePayslip (Calcul complet d’un bulletin)', () => {
    it('devrait calculer exactement les cotisations CNSS, le VPS, l’ITS et le Net à Payer', () => {
      const input = {
        salaireBase: 350000,
        heuresNormales: 173.33,
        heuresSup15: 10, // 10h majorées à 15%
        heuresSup50: 5,  // 5h majorées à 50%
        primesBrutesImposables: 50000,
        indemnitesNonImposables: 25000, // Transport non imposable
        retenuesDiverses: 10000, // Avance sur salaire
      };

      const result = service.calculatePayslip(input);

      expect(result.salaireBase).toBe(350000);
      expect(result.montantHeuresSup).toBeGreaterThan(0);
      expect(result.totalSalaireBrut).toBeGreaterThan(350000);

      // Vérification CNSS
      // CNSS Salariale = 3.6% de l'assiette CNSS
      expect(result.montantCnssSalariale).toBe(Math.round(result.totalAssietteCnss * 0.036));
      // CNSS Patronale = 17.4% de l'assiette CNSS
      expect(result.montantCnssPatronale).toBe(Math.round(result.totalAssietteCnss * 0.174));

      // Vérification VPS (4%)
      expect(result.montantVpsPatronale).toBe(Math.round(result.totalAssietteVps * 0.04));

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
