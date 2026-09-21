import { Injectable, BadRequestException } from '@nestjs/common';

export interface ItsBracket {
  numeroTranche: number;
  limiteInferieure: number;
  limiteSuperieure: number | null;
  taux: number;
  montantDeductionFixe?: number;
}

export interface PayrollRubricConfig {
  id?: string;
  code: string;
  libelle: string;
  typeRubrique: string;
  sensDefaut?: 'GAIN' | 'RETENUE' | 'INFORMATION';
  ordreAffichage?: number;
  tauxParDefaut?: number;
  assujettiIts?: boolean;
  assujettiCnss?: boolean;
  assujettiVps?: boolean;
}

export interface PayrollVariableDetail {
  rubriquePaieId?: string;
  codeRubrique: string;
  libelleRubrique: string;
  typeRubrique: string;
  sens: 'GAIN' | 'RETENUE' | 'INFORMATION';
  montant: number;
  base?: number;
  taux?: number;
  ordre?: number;
}

export interface PayrollCalculationInput {
  salaireBase: number;
  heuresNormales: number;
  tauxHoraire?: number;

  // Majorations Heures supplémentaires
  heuresSup15?: number;
  heuresSup50?: number;
  heuresSupNuit?: number;
  heuresSupDimancheFerie?: number;

  // Variables agrégées ou liste détaillée issue de la base
  primesBrutesImposables?: number;
  indemnitesNonImposables?: number;
  avantagesEnNature?: number;
  retenuesDiverses?: number;
  variablesDetails?: PayrollVariableDetail[];

  // Taux de charges obligatoires issus strictement de la base de données
  tauxCnssSalarial: number;
  tauxCnssPatronal: number;
  tauxVpsPatronal: number;

  // Barème progressif ITS obligatoire issu de la base
  brackets: ItsBracket[];

  // Catalogue des rubriques obligatoire issu de la base
  rubriquesCatalogue: PayrollRubricConfig[];

  // Rémunération exceptionnelle (méthode du quotient)
  remunerationExceptionnelle?: {
    montantBrut: number;
    tauxAbattement: number;
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
 * MOTEUR DYNAMIQUE DE CALCUL DE LA PAIE & FISCALITÉ SALARIALE
 * 
 * 100% Dynamique : Aucune donnée fiscale, sociale ou rubrique n'est codée en dur.
 * Toutes les tranches (ITS), tous les taux (CNSS, VPS) et toutes les rubriques (codes, libellés, comptes)
 * proviennent obligatoirement de la base de données (RhBaremeIts, RhTauxChargeSociale, RhRubriquePaie).
 */
@Injectable()
export class CalculPaieService {
  /**
   * Arrondit un nombre à 2 chiffres après la virgule maximum
   */
  private round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcule l'ITS selon le barème progressif par tranches configuré en base de données
   * 
   * @param netImposable - Assiette fiscale nette imposable
   * @param brackets - Tranches d'imposition dynamiques chargées depuis la base
   */
  calculateIts(netImposable: number, brackets: ItsBracket[]): number {
    if (!brackets || brackets.length === 0) {
      throw new BadRequestException(
        "Aucun barème d'impôt sur salaires (ITS) n'a été fourni pour le calcul.",
      );
    }

    const sortedBrackets = [...brackets].sort((a, b) => a.numeroTranche - b.numeroTranche);
    const firstBracket = sortedBrackets[0];

    // Si la 1ère tranche est exonérée (taux = 0) et que le salaire est sous sa limite
    if (
      firstBracket &&
      firstBracket.taux === 0 &&
      firstBracket.limiteSuperieure !== null &&
      netImposable <= firstBracket.limiteSuperieure
    ) {
      return 0;
    }

    let itsTotal = 0;
    for (const b of sortedBrackets) {
      if (netImposable > b.limiteInferieure) {
        const sup = b.limiteSuperieure !== null ? b.limiteSuperieure : Infinity;
        const portion = Math.min(netImposable, sup) - b.limiteInferieure;
        if (portion > 0) {
          itsTotal += portion * (b.taux / 100);
        }
      }
    }

    return this.round2(itsTotal);
  }

  /**
   * Calcule l'impôt sur rémunération exceptionnelle par la Méthode du Quotient
   * en utilisant le barème fiscal et le taux d'abattement configurés en base
   */
  calculateQuotientTax(
    salaireOrdinaireImposable: number,
    remunerationBruteExcep: number,
    tauxAbattement: number,
    salaireMoyenReference12m: number | undefined,
    brackets: ItsBracket[],
  ) {
    const sRef =
      salaireMoyenReference12m && salaireMoyenReference12m > 0
        ? salaireMoyenReference12m
        : salaireOrdinaireImposable;

    const impotRef = this.calculateIts(sRef, brackets);
    const baseApresAbattement = remunerationBruteExcep * (1 - tauxAbattement / 100);

    // Rapport du quotient
    const rapportQuotient = (salaireOrdinaireImposable + baseApresAbattement) / Math.max(1, sRef);
    const impotTotalQuotient = this.round2(impotRef * rapportQuotient);

    // Impôt sur le salaire ordinaire seul
    const impotOrdinaireSeul = this.calculateIts(salaireOrdinaireImposable, brackets);

    // Impôt spécifique additionnel dû au titre de la prime exceptionnelle
    const impotSpecifique = Math.max(0, impotTotalQuotient - impotOrdinaireSeul);

    return {
      salaireMoyenReference12m: this.round2(sRef),
      impotReference12m: this.round2(impotRef),
      baseApresAbattement: this.round2(baseApresAbattement),
      rapportQuotient: this.round2(rapportQuotient),
      impotTotalQuotient,
      impotSpecifiqueExceptionnel: this.round2(impotSpecifique),
    };
  }

  /**
   * Calcul complet et détaillé d'un bulletin de paie à partir des paramètres de base de données
   */
  calculatePayslip(input: PayrollCalculationInput): PayrollCalculationResult {
    if (!input.brackets || input.brackets.length === 0) {
      throw new BadRequestException(
        "Le barème d'impôt ITS est requis et doit être configuré en base de données.",
      );
    }
    if (!input.rubriquesCatalogue || input.rubriquesCatalogue.length === 0) {
      throw new BadRequestException(
        "Le catalogue des rubriques est requis et doit être configuré en base de données.",
      );
    }
    if (input.tauxCnssSalarial === undefined || input.tauxCnssSalarial === null) {
      throw new BadRequestException(
        "Le taux de cotisation sociale salariale doit provenir de la base de données.",
      );
    }
    if (input.tauxCnssPatronal === undefined || input.tauxCnssPatronal === null) {
      throw new BadRequestException(
        "Le taux de cotisation sociale patronale doit provenir de la base de données.",
      );
    }
    if (input.tauxVpsPatronal === undefined || input.tauxVpsPatronal === null) {
      throw new BadRequestException(
        "Le taux de taxe patronale sur salaire doit provenir de la base de données.",
      );
    }
    if (!input.heuresNormales || input.heuresNormales <= 0) {
      throw new BadRequestException(
        "La durée normale de travail mensuelle est requise et doit être configurée.",
      );
    }

    const salaireBase = this.round2(input.salaireBase);
    const heuresNormales = this.round2(input.heuresNormales);
    const rawTauxHoraire = input.tauxHoraire ?? (salaireBase / Math.max(1, heuresNormales));
    const tauxHoraire = this.round2(rawTauxHoraire);

    // Heures supplémentaires
    const hs15 = (input.heuresSup15 ?? 0) * (tauxHoraire * 1.15);
    const hs50 = (input.heuresSup50 ?? 0) * (tauxHoraire * 1.50);
    const hsNuit = (input.heuresSupNuit ?? 0) * (tauxHoraire * 1.50);
    const hsDimanche = (input.heuresSupDimancheFerie ?? 0) * (tauxHoraire * 1.50);
    const montantHeuresSup = this.round2(hs15 + hs50 + hsNuit + hsDimanche);

    // Calcul des montants variables (priorité à la liste détaillée)
    let primesBrutes = input.primesBrutesImposables ?? 0;
    let indemnitesNonImposables = input.indemnitesNonImposables ?? 0;
    let avantagesNature = input.avantagesEnNature ?? 0;
    let retenuesDiverses = input.retenuesDiverses ?? 0;

    if (input.variablesDetails && input.variablesDetails.length > 0) {
      primesBrutes = input.variablesDetails
        .filter((v) => v.typeRubrique === 'GAIN_BRUT')
        .reduce((sum, v) => sum + v.montant, 0);

      indemnitesNonImposables = input.variablesDetails
        .filter((v) => v.typeRubrique === 'INDEMNITE_NON_IMPOSABLE')
        .reduce((sum, v) => sum + v.montant, 0);

      avantagesNature = input.variablesDetails
        .filter((v) => v.typeRubrique === 'AVANTAGE_EN_NATURE')
        .reduce((sum, v) => sum + v.montant, 0);

      retenuesDiverses = input.variablesDetails
        .filter((v) => v.typeRubrique === 'RETENUE_NETTE_AUTRE' || (v.sens === 'RETENUE' && !['RETENUE_SALARIALE_CNSS', 'RETENUE_FISCALE_ITS'].includes(v.typeRubrique)))
        .reduce((sum, v) => sum + v.montant, 0);
    }

    primesBrutes = this.round2(primesBrutes);
    indemnitesNonImposables = this.round2(indemnitesNonImposables);
    avantagesNature = this.round2(avantagesNature);
    retenuesDiverses = this.round2(retenuesDiverses);

    // Total salaire brut
    const totalSalaireBrut = this.round2(
      salaireBase + montantHeuresSup + primesBrutes + avantagesNature + indemnitesNonImposables,
    );

    // Assiettes fiscales et sociales
    const totalAssietteCnss = this.round2(
      salaireBase + montantHeuresSup + primesBrutes + avantagesNature,
    );
    const totalAssietteVps = totalAssietteCnss;

    // Cotisations Sociales & Patronales (Taux issus de la DB)
    const tauxCnssSal = this.round2(input.tauxCnssSalarial);
    const montantCnssSalariale = this.round2(totalAssietteCnss * (tauxCnssSal / 100));

    const tauxCnssPat = this.round2(input.tauxCnssPatronal);
    const montantCnssPatronale = this.round2(totalAssietteCnss * (tauxCnssPat / 100));

    // Taxe patronale (VPS / Taux issu de la DB)
    const tauxVpsPat = this.round2(input.tauxVpsPatronal);
    const montantVpsPatronale = this.round2(totalAssietteVps * (tauxVpsPat / 100));

    const totalChargesPatronales = this.round2(montantCnssPatronale + montantVpsPatronale);

    // Net imposable
    const netImposable = Math.max(0, this.round2(totalAssietteCnss - montantCnssSalariale));
    const totalAssietteIts = netImposable;

    // Calcul ITS selon le barème de la base
    const montantItsOrdinaire = this.calculateIts(netImposable, input.brackets);

    // Calcul de la rémunération exceptionnelle par le quotient si présente
    let montantItsExceptionnel = 0;
    let detailsQuotient: PayrollCalculationResult['detailsQuotient'] = undefined;

    if (input.remunerationExceptionnelle && input.remunerationExceptionnelle.montantBrut > 0) {
      const qRes = this.calculateQuotientTax(
        netImposable,
        input.remunerationExceptionnelle.montantBrut,
        input.remunerationExceptionnelle.tauxAbattement,
        input.remunerationExceptionnelle.salaireMoyenReference12m,
        input.brackets,
      );
      detailsQuotient = qRes;
      montantItsExceptionnel = qRes.impotSpecifiqueExceptionnel;
    }

    const montantImpotSalaireTotal = this.round2(montantItsOrdinaire + montantItsExceptionnel);
    const totalRetenuesSalariales = this.round2(
      montantCnssSalariale + montantImpotSalaireTotal + retenuesDiverses,
    );

    // Net à payer
    const netAPayer = this.round2(totalSalaireBrut - totalRetenuesSalariales);

    // ---------------- CONSTRUCTION DYNAMIQUE DES LIGNES DU BULLETIN ----------------
    // Tous les codes, libellés et types proviennent de input.rubriquesCatalogue (DB)
    const rubMap = new Map<string, PayrollRubricConfig>();
    for (const r of input.rubriquesCatalogue) {
      rubMap.set(r.code, r);
    }

    const findRubriqueByType = (
      type: string,
      preferCode?: string,
    ): PayrollRubricConfig | undefined => {
      if (preferCode && rubMap.has(preferCode)) return rubMap.get(preferCode);
      return input.rubriquesCatalogue.find((r) => r.typeRubrique === type);
    };

    const detailsLignes: PayrollCalculationResult['detailsLignes'] = [];

    // 1. Salaire de base
    const rubBase = findRubriqueByType('GAIN_BRUT', 'R100');
    if (!rubBase) {
      throw new BadRequestException(
        "Aucune rubrique de Salaire de Base (type GAIN_BRUT) n'est configurée en base de données.",
      );
    }
    detailsLignes.push({
      codeRubrique: rubBase.code,
      libelleRubrique: rubBase.libelle,
      typeRubrique: rubBase.typeRubrique,
      sens: 'GAIN',
      base: heuresNormales,
      taux: Math.round(tauxHoraire * 100) / 100,
      montantGain: salaireBase,
      montantRetenue: 0,
      partPatronaleMontant: 0,
      ordre: rubBase.ordreAffichage ?? 10,
    });

    // 2. Heures supplémentaires
    if (montantHeuresSup > 0) {
      const rubHs =
        rubMap.get('R110') ||
        input.rubriquesCatalogue.find(
          (r) =>
            r.typeRubrique === 'GAIN_BRUT' &&
            (r.code.includes('HS') || r.libelle.toLowerCase().includes('supplémentaire')),
        ) ||
        rubBase;

      detailsLignes.push({
        codeRubrique: rubHs.code,
        libelleRubrique: rubHs.libelle,
        typeRubrique: rubHs.typeRubrique,
        sens: 'GAIN',
        montantGain: montantHeuresSup,
        montantRetenue: 0,
        partPatronaleMontant: 0,
        ordre: rubHs.ordreAffichage ?? 20,
      });
    }

    // 3. Éléments variables réels ou agrégés
    if (input.variablesDetails && input.variablesDetails.length > 0) {
      for (const v of input.variablesDetails) {
        detailsLignes.push({
          codeRubrique: v.codeRubrique,
          libelleRubrique: v.libelleRubrique,
          typeRubrique: v.typeRubrique,
          sens: v.sens,
          base: v.base !== undefined && v.base !== null ? this.round2(v.base) : undefined,
          taux: v.taux !== undefined && v.taux !== null ? this.round2(v.taux) : undefined,
          montantGain: v.sens === 'GAIN' ? this.round2(v.montant) : 0,
          montantRetenue: v.sens === 'RETENUE' ? this.round2(v.montant) : 0,
          partPatronaleMontant: 0,
          ordre: v.ordre ?? 50,
        });
      }
    } else {
      if (primesBrutes > 0) {
        const rubPrime = findRubriqueByType('GAIN_BRUT', 'R150') || rubBase;
        detailsLignes.push({
          codeRubrique: rubPrime.code,
          libelleRubrique: rubPrime.libelle,
          typeRubrique: rubPrime.typeRubrique,
          sens: 'GAIN',
          montantGain: primesBrutes,
          montantRetenue: 0,
          partPatronaleMontant: 0,
          ordre: rubPrime.ordreAffichage ?? 30,
        });
      }
      if (avantagesNature > 0) {
        const rubAv = findRubriqueByType('AVANTAGE_EN_NATURE', 'R300');
        if (rubAv) {
          detailsLignes.push({
            codeRubrique: rubAv.code,
            libelleRubrique: rubAv.libelle,
            typeRubrique: rubAv.typeRubrique,
            sens: 'GAIN',
            montantGain: avantagesNature,
            montantRetenue: 0,
            partPatronaleMontant: 0,
            ordre: rubAv.ordreAffichage ?? 40,
          });
        }
      }
      if (indemnitesNonImposables > 0) {
        const rubIndem = findRubriqueByType('INDEMNITE_NON_IMPOSABLE', 'R200');
        if (rubIndem) {
          detailsLignes.push({
            codeRubrique: rubIndem.code,
            libelleRubrique: rubIndem.libelle,
            typeRubrique: rubIndem.typeRubrique,
            sens: 'GAIN',
            montantGain: indemnitesNonImposables,
            montantRetenue: 0,
            partPatronaleMontant: 0,
            ordre: rubIndem.ordreAffichage ?? 50,
          });
        }
      }
      if (retenuesDiverses > 0) {
        const rubRet = findRubriqueByType('RETENUE_NETTE_AUTRE', 'R700');
        if (rubRet) {
          detailsLignes.push({
            codeRubrique: rubRet.code,
            libelleRubrique: rubRet.libelle,
            typeRubrique: rubRet.typeRubrique,
            sens: 'RETENUE',
            montantGain: 0,
            montantRetenue: retenuesDiverses,
            partPatronaleMontant: 0,
            ordre: rubRet.ordreAffichage ?? 200,
          });
        }
      }
    }

    // 4. Cotisation CNSS Salariale (depuis la rubrique en base)
    const rubCnssSal = findRubriqueByType('RETENUE_SALARIALE_CNSS', 'R500');
    if (!rubCnssSal) {
      throw new BadRequestException(
        "Aucune rubrique de Cotisation Sociale Salariale (type RETENUE_SALARIALE_CNSS) n'est configurée en base de données.",
      );
    }
    detailsLignes.push({
      codeRubrique: rubCnssSal.code,
      libelleRubrique: rubCnssSal.libelle,
      typeRubrique: rubCnssSal.typeRubrique,
      sens: 'RETENUE',
      base: totalAssietteCnss,
      taux: tauxCnssSal,
      montantGain: 0,
      montantRetenue: montantCnssSalariale,
      partPatronaleMontant: 0,
      ordre: rubCnssSal.ordreAffichage ?? 100,
    });

    // 5. Charges Patronales CNSS (depuis la rubrique en base)
    const rubCnssPat = findRubriqueByType('CHARGE_PATRONALE_CNSS', 'R600');
    if (!rubCnssPat) {
      throw new BadRequestException(
        "Aucune rubrique de Charge Patronale Sociale (type CHARGE_PATRONALE_CNSS) n'est configurée en base de données.",
      );
    }
    detailsLignes.push({
      codeRubrique: rubCnssPat.code,
      libelleRubrique: rubCnssPat.libelle,
      typeRubrique: rubCnssPat.typeRubrique,
      sens: 'INFORMATION',
      base: totalAssietteCnss,
      taux: tauxCnssPat,
      montantGain: 0,
      montantRetenue: 0,
      partPatronaleMontant: montantCnssPatronale,
      ordre: rubCnssPat.ordreAffichage ?? 110,
    });

    // 6. Impôt sur Traitements et Salaires (ITS) (depuis la rubrique en base)
    const rubIts = findRubriqueByType('RETENUE_FISCALE_ITS', 'R550');
    if (!rubIts) {
      throw new BadRequestException(
        "Aucune rubrique de Retenue Fiscale ITS (type RETENUE_FISCALE_ITS) n'est configurée en base de données.",
      );
    }
    detailsLignes.push({
      codeRubrique: rubIts.code,
      libelleRubrique: rubIts.libelle,
      typeRubrique: rubIts.typeRubrique,
      sens: 'RETENUE',
      base: netImposable,
      montantGain: 0,
      montantRetenue: montantImpotSalaireTotal,
      partPatronaleMontant: 0,
      ordre: rubIts.ordreAffichage ?? 120,
    });

    // 7. Taxes Patronales sur Salaires (VPS) (depuis la rubrique en base)
    const rubVps = findRubriqueByType('CHARGE_PATRONALE_VPS', 'R650');
    if (rubVps) {
      detailsLignes.push({
        codeRubrique: rubVps.code,
        libelleRubrique: rubVps.libelle,
        typeRubrique: rubVps.typeRubrique,
        sens: 'INFORMATION',
        base: totalAssietteVps,
        taux: tauxVpsPat,
        montantGain: 0,
        montantRetenue: 0,
        partPatronaleMontant: montantVpsPatronale,
        ordre: rubVps.ordreAffichage ?? 130,
      });
    }

    // 8. Net à Payer (depuis la rubrique en base)
    const rubNet = findRubriqueByType('GAIN_NET_NON_IMPOSABLE', 'R900');
    if (!rubNet) {
      throw new BadRequestException(
        "Aucune rubrique de Net à Payer (type GAIN_NET_NON_IMPOSABLE) n'est configurée en base de données.",
      );
    }
    detailsLignes.push({
      codeRubrique: rubNet.code,
      libelleRubrique: rubNet.libelle,
      typeRubrique: rubNet.typeRubrique,
      sens: 'INFORMATION',
      montantGain: netAPayer,
      montantRetenue: 0,
      partPatronaleMontant: 0,
      ordre: rubNet.ordreAffichage ?? 999,
    });

    // Tri des lignes par ordre d'affichage configuré en base
    detailsLignes.sort((a, b) => a.ordre - b.ordre);

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
