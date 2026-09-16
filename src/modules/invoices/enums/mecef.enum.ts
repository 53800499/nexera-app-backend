/**
 * Statut de normalisation e-MECeF / DGI Bénin (UC-05 / Décret facturation normalisée).
 */
export enum InvoiceNormalizationStatus {
  NOT_NORMALIZED = 'not_normalized',
  PENDING = 'pending',
  NORMALIZED = 'normalized',
  FAILED = 'failed',
}

/**
 * Groupes de taxation officiels e-MECeF DGI :
 * - A : Exonéré de TVA (0%)
 * - B : Taxable normal (18%)
 * - C : Exportation (0%)
 * - D : Régime d'exception / spécifique (0%)
 * - E : Régime fiscal synthétique (TPS)
 * - F : Réservé
 */
export enum MecefTaxGroup {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

/**
 * Type d'Acompte sur Impôt Assis sur les Bénéfices (AIB Bénin) :
 * - NONE : Aucun AIB (0%)
 * - A : AIB 1% (Entreprise ou client immatriculé avec IFU valide)
 * - B : AIB 5% (Particulier ou prestataire non immatriculé)
 */
export enum MecefAibType {
  NONE = 'NONE',
  A = 'A',
  B = 'B',
}

/**
 * Environnement de connexion à l'API e-MECeF DGI.
 */
export enum MecefEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

/**
 * Taux d'AIB en pourcentage selon le type.
 */
export const MECEF_AIB_RATES: Record<MecefAibType, number> = {
  [MecefAibType.NONE]: 0,
  [MecefAibType.A]: 1,
  [MecefAibType.B]: 5,
};
