import { Injectable } from '@nestjs/common';

export interface ItsBracket {
  numeroTranche: number;
  limiteInferieure: number;
  limiteSuperieure: number | null;
  taux: number;
  montantDeductionFixe?: number;
}

export interface PayrollCalculationInput {
  salaireBase: number;
  tauxHoraire?: number;
  heuresNormales?: number;
  heuresSup15?: number;
  heuresSup50?: number;
  heuresSupNuit?: number;
  heuresSupDimancheFerie?: number;
  primesBrutesImposables?: number;
  indemnitesNonImposables?: number;
  avantagesEnNature?: number;
  retenuesDiverses?: number;
  // Prélèvements personnalisés ou barèmes
  tauxCnssSalarial?: number; // Défaut 3.6%
  tauxCnssPatronal?: number; // Défaut 17.4%
  tauxVpsPatronal?: number; // Défaut 4.0%
  customBrackets?: ItsBracket[];
  // Rémunération exceptionnelle (13e mois / prime de bilan avec méthode du quotient)
  remunerationExceptionnelle?: {
    montantBrut: number;
    tauxAbattement?: number; // Défaut 25% (Bénin Art. 126)
    salaireMoyenReference12m?: number;
  };
}

export interface PayrollCalculationResult {
  salaireBase: number;
  heuresNormales: number;
  montantHeuresSup: number;
  montantPrimesBrutes: number;
  montantIndemnitesNonImposables: number;
  montantAvantagesNature: number;
  totalSalaireBrut: number;
  totalAssietteCnss: number;
  totalAssietteIts: number;
  totalAssietteVps: number;
  montantCnssSalariale: number;
  montantCnssPatronale: number;
  montantVpsPatronale: number;
  totalChargesPatronales: number;
  netImposable: number;
  montantItsOrdinaire: number;
  montantItsExceptionnel: number;
  montantImpotSalaireTotal: number;
  totalRetenuesSalariales: number;
  netAPayer: number;
  detailsLignes: Array<{
    codeRubrique: string;
    libelleRubrique: string;
    typeRubrique: string;
    sens: 'GAIN' | 'RETENUE' | 'INFORMATION';
    base?: number;
    taux?: number;
    montantGain: number;
    montantRetenue: number;
    partPatronaleMontant: number;
    ordre: number;
  }>;
  detailsQuotient?: {
    salaireMoyenReference12m: number;
    impotReference12m: number;
    baseApresAbattement: number;
    rapportQuotient: number;
    impotTotalQuotient: number;
    impotSpecifiqueExceptionnel: number;
  };
}

/**
 * MOTEUR DE CALCUL DE LA PAIE & FISCALITÉ SALARIALE
 * 
 * Implémente rigoureusement les dispositions du Code Général des Impôts du Bénin (CGI 2026)
 * et du Code du Travail de la République du Bénin :
 * 
 * 1. Barème progressif ITS (Art. 125 CGI Bénin) :
 *    - Tranche 1 : 0 à 50 000 FCFA               -> 0 % (Exonéré)
 *    - Tranche 2 : 50 001 à 130 000 FCFA         -> 10 %
 *    - Tranche 3 : 130 001 à 280 000 FCFA        -> 15 %
 *    - Tranche 4 : 280 001 à 530 000 FCFA        -> 20 %
 *    - Tranche 5 : Plus de 530 000 FCFA          -> 30 %
 * 
 * 2. Rémunérations exceptionnelles (Art. 126 CGI Bénin - Méthode du Quotient) :
 *    - Application d'un abattement forfaitaire de 25% sur les gratifications et 13e mois
 *    - Calcul de l'impôt avec étalement sur le salaire moyen des 12 derniers mois
 *    - Empêche le saut de tranche fiscal injuste pour le collaborateur
 * 
 * 3. Cotisations Sociales & Patronales :
 *    - CNSS Salariale (Régime Général Retraite / Prestations) : 3,6 %
 *    - CNSS Patronale (Prestations Familiales, Risques Pro, Vieillesse) : 17,4 %
 *    - VPS (Versement Patronal sur Salaires dû au Trésor Public) : 4,0 %
 * 
 * 4. Heures Supplémentaires & Majorations Légales :
 *    - Heures de jour (41e à 48e heure hebdomadaire) : +15 %
 *    - Heures au-delà de la 48e heure : +50 %
 *    - Heures de nuit (21h à 5h) : +50 %
 *    - Dimanches et jours fériés : +50 % (jour) ou +100 % (nuit)
 */
@Injectable()
export class CalculPaieService {
  /** Barème officiel de l'Impôt sur les Traitements et Salaires (CGI Bénin 2026 Art. 125) */
  private readonly defaultItsBrackets: ItsBracket[] = [
    { numeroTranche: 1, limiteInferieure: 0, limiteSuperieure: 50000, taux: 0 },
    { numeroTranche: 2, limiteInferieure: 50000, limiteSuperieure: 130000, taux: 10 },
    { numeroTranche: 3, limiteInferieure: 130000, limiteSuperieure: 280000, taux: 15 },
    { numeroTranche: 4, limiteInferieure: 280000, limiteSuperieure: 530000, taux: 20 },
    { numeroTranche: 5, limiteInferieure: 530000, limiteSuperieure: null, taux: 30 },
  ];

  /**
   * Calcule l'ITS selon le barème progressif par tranches (Bénin CGI 2026)
   */
  calculateIts(netImposable: number, brackets: ItsBracket[] = this.defaultItsBrackets): number {
    if (netImposable <= 50000) {
      return 0;
    }

    let itsTotal = 0;
    const sortedBrackets = [...brackets].sort((a, b) => a.numeroTranche - b.numeroTranche);

    for (const b of sortedBrackets) {
      if (netImposable > b.limiteInferieure) {
        const sup = b.limiteSuperieure !== null ? b.limiteSuperieure : Infinity;
        const portion = Math.min(netImposable, sup) - b.limiteInferieure;
        if (portion > 0) {
          itsTotal += portion * (b.taux / 100);
        }
      }
    }

    return Math.round(itsTotal);
  }

  /**
   * Calcule l'impôt sur rémunération exceptionnelle par la Méthode du Quotient (Art. 126 CGI Bénin 2026)
   */
  calculateQuotientTax(
    salaireOrdinaireImposable: number,
    remunerationBruteExcep: number,
    tauxAbattement = 25,
    salaireMoyenReference12m?: number,
    brackets: ItsBracket[] = this.defaultItsBrackets,
  ) {
    const sRef = salaireMoyenReference12m && salaireMoyenReference12m > 0
      ? salaireMoyenReference12m
      : salaireOrdinaireImposable;

    const impotRef = this.calculateIts(sRef, brackets);
    const baseApresAbattement = remunerationBruteExcep * (1 - (tauxAbattement / 100));

    // Rapport du quotient
    const rapportQuotient = (salaireOrdinaireImposable + baseApresAbattement) / Math.max(1, sRef);
    const impotTotalQuotient = Math.round(impotRef * rapportQuotient);

    // Impôt sur le salaire ordinaire seul
    const impotOrdinaireSeul = this.calculateIts(salaireOrdinaireImposable, brackets);

    // Impôt spécifique additionnel dû au titre de la prime exceptionnelle
    const impotSpecifique = Math.max(0, impotTotalQuotient - impotOrdinaireSeul);

    return {
      salaireMoyenReference12m: sRef,
      impotReference12m: impotRef,
      baseApresAbattement,
      rapportQuotient: Math.round(rapportQuotient * 10000) / 10000,
      impotTotalQuotient,
      impotSpecifiqueExceptionnel: impotSpecifique,
    };
  }

  /**
   * Calcul complet et détaillé d'un bulletin de paie
   */
  calculatePayslip(input: PayrollCalculationInput): PayrollCalculationResult {
    const salaireBase = input.salaireBase;
    const heuresNormales = input.heuresNormales ?? 173.33;
    const tauxHoraire = input.tauxHoraire ?? (salaireBase / 173.33);

    // Heures supplémentaires
    const hs15 = (input.heuresSup15 ?? 0) * (tauxHoraire * 1.15);
    const hs50 = (input.heuresSup50 ?? 0) * (tauxHoraire * 1.50);
    const hsNuit = (input.heuresSupNuit ?? 0) * (tauxHoraire * 1.50);
    const hsDimanche = (input.heuresSupDimancheFerie ?? 0) * (tauxHoraire * 1.50);
    const montantHeuresSup = Math.round(hs15 + hs50 + hsNuit + hsDimanche);

    const primesBrutes = input.primesBrutesImposables ?? 0;
    const avantagesNature = input.avantagesEnNature ?? 0;
    const indemnitesNonImposables = input.indemnitesNonImposables ?? 0;

    // Total salaire brut
    const totalSalaireBrut = Math.round(
      salaireBase + montantHeuresSup + primesBrutes + avantagesNature + indemnitesNonImposables,
    );

    // Assiettes fiscales et sociales
    const totalAssietteCnss = Math.round(salaireBase + montantHeuresSup + primesBrutes + avantagesNature);
    const totalAssietteVps = totalAssietteCnss;

    // Cotisations CNSS
    const tauxCnssSal = input.tauxCnssSalarial ?? 3.6;
    const montantCnssSalariale = Math.round(totalAssietteCnss * (tauxCnssSal / 100));

    const tauxCnssPat = input.tauxCnssPatronal ?? 17.4;
    const montantCnssPatronale = Math.round(totalAssietteCnss * (tauxCnssPat / 100));

    // VPS (Versement Patronal sur Salaires 4%)
    const tauxVpsPat = input.tauxVpsPatronal ?? 4.0;
    const montantVpsPatronale = Math.round(totalAssietteVps * (tauxVpsPat / 100));

    const totalChargesPatronales = montantCnssPatronale + montantVpsPatronale;

    // Net imposable
    const netImposable = Math.max(0, totalAssietteCnss - montantCnssSalariale);
    const totalAssietteIts = netImposable;

    // Calcul ITS Ordinaire
    const brackets = input.customBrackets && input.customBrackets.length > 0
      ? input.customBrackets
      : this.defaultItsBrackets;

    const montantItsOrdinaire = this.calculateIts(netImposable, brackets);

    // Calcul éventuel de rémunération exceptionnelle par la méthode du quotient
    let montantItsExceptionnel = 0;
    let detailsQuotient: PayrollCalculationResult['detailsQuotient'] = undefined;

    if (input.remunerationExceptionnelle && input.remunerationExceptionnelle.montantBrut > 0) {
      const qRes = this.calculateQuotientTax(
        netImposable,
        input.remunerationExceptionnelle.montantBrut,
        input.remunerationExceptionnelle.tauxAbattement ?? 25,
        input.remunerationExceptionnelle.salaireMoyenReference12m,
        brackets,
      );
      detailsQuotient = qRes;
      montantItsExceptionnel = qRes.impotSpecifiqueExceptionnel;
    }

    const montantImpotSalaireTotal = montantItsOrdinaire + montantItsExceptionnel;
    const retenuesDiverses = input.retenuesDiverses ?? 0;
    const totalRetenuesSalariales = montantCnssSalariale + montantImpotSalaireTotal + retenuesDiverses;

    // Net à payer
    const netAPayer = Math.round(totalSalaireBrut - totalRetenuesSalariales);

    // Construction des lignes de bulletin détaillées
    const detailsLignes: PayrollCalculationResult['detailsLignes'] = [
      {
        codeRubrique: 'R100',
        libelleRubrique: 'Salaire de Base',
        typeRubrique: 'GAIN_BRUT',
        sens: 'GAIN',
        base: heuresNormales,
        taux: tauxHoraire,
        montantGain: salaireBase,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: 10,
      },
    ];

    if (montantHeuresSup > 0) {
      detailsLignes.push({
        codeRubrique: 'R110',
        libelleRubrique: 'Heures Supplémentaires',
        typeRubrique: 'GAIN_BRUT',
        sens: 'GAIN',
        montantGain: montantHeuresSup,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: 20,
      });
    }

    if (primesBrutes > 0) {
      detailsLignes.push({
        codeRubrique: 'R150',
        libelleRubrique: 'Primes et Gratifications',
        typeRubrique: 'GAIN_BRUT',
        sens: 'GAIN',
        montantGain: primesBrutes,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: 30,
      });
    }

    if (avantagesNature > 0) {
      detailsLignes.push({
        codeRubrique: 'R300',
        libelleRubrique: 'Avantages en Nature (CGI Art. 123)',
        typeRubrique: 'AVANTAGE_EN_NATURE',
        sens: 'GAIN',
        montantGain: avantagesNature,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: 40,
      });
    }

    if (indemnitesNonImposables > 0) {
      detailsLignes.push({
        codeRubrique: 'R200',
        libelleRubrique: 'Indemnités Non Imposables (Transport / Panier)',
        typeRubrique: 'INDEMNITE_NON_IMPOSABLE',
        sens: 'GAIN',
        montantGain: indemnitesNonImposables,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: 50,
      });
    }

    // CNSS Salariale & Patronale
    detailsLignes.push({
      codeRubrique: 'R500',
      libelleRubrique: 'Cotisation CNSS Retraite Salariale (3.6 %)',
      typeRubrique: 'RETENUE_SALARIALE_CNSS',
      sens: 'RETENUE',
      base: totalAssietteCnss,
      taux: tauxCnssSal,
      montantGain: 0,
      montantRetenue: montantCnssSalariale,
      partPatronaleMontant: 0,
      ordre: 100,
    });

    detailsLignes.push({
      codeRubrique: 'R600',
      libelleRubrique: 'Cotisations CNSS Patronales (17.4 %)',
      typeRubrique: 'CHARGE_PATRONALE_CNSS',
      sens: 'INFORMATION',
      base: totalAssietteCnss,
      taux: tauxCnssPat,
      montantGain: 0,
      montantRetenue: 0,
      partPatronaleMontant: montantCnssPatronale,
      ordre: 110,
    });

    // ITS
    detailsLignes.push({
      codeRubrique: 'R550',
      libelleRubrique: 'Impôt sur Traitements et Salaires (ITS Bénin 2026)',
      typeRubrique: 'RETENUE_FISCALE_ITS',
      sens: 'RETENUE',
      base: netImposable,
      montantGain: 0,
      montantRetenue: montantImpotSalaireTotal,
      partPatronaleMontant: 0,
      ordre: 120,
    });

    // VPS Patronale (4%)
    detailsLignes.push({
      codeRubrique: 'R650',
      libelleRubrique: 'Versement Patronal sur Salaires (VPS 4 %)',
      typeRubrique: 'CHARGE_PATRONALE_VPS',
      sens: 'INFORMATION',
      base: totalAssietteVps,
      taux: tauxVpsPat,
      montantGain: 0,
      montantRetenue: 0,
      partPatronaleMontant: montantVpsPatronale,
      ordre: 130,
    });

    if (retenuesDiverses > 0) {
      detailsLignes.push({
        codeRubrique: 'R700',
        libelleRubrique: 'Retenues Diverses / Avances sur Salaire',
        typeRubrique: 'RETENUE_NETTE_AUTRE',
        sens: 'RETENUE',
        montantGain: 0,
        montantRetenue: retenuesDiverses,
        partPatronaleMontant: 0,
        ordre: 200,
      });
    }

    detailsLignes.push({
      codeRubrique: 'R900',
      libelleRubrique: 'Net à Payer',
      typeRubrique: 'GAIN_NET_NON_IMPOSABLE',
      sens: 'INFORMATION',
      montantGain: netAPayer,
      montantRetenue: 0,
      partPatronaleMontant: 0,
      ordre: 999,
    });

    return {
      salaireBase,
      heuresNormales,
      montantHeuresSup,
      montantPrimesBrutes: primesBrutes,
      montantIndemnitesNonImposables: indemnitesNonImposables,
      montantAvantagesNature: avantagesNature,
      totalSalaireBrut,
      totalAssietteCnss,
      totalAssietteIts,
      totalAssietteVps,
      montantCnssSalariale,
      montantCnssPatronale,
      montantVpsPatronale,
      totalChargesPatronales,
      netImposable,
      montantItsOrdinaire,
      montantItsExceptionnel,
      montantImpotSalaireTotal,
      totalRetenuesSalariales,
      netAPayer,
      detailsLignes,
      detailsQuotient,
    };
  }
}
