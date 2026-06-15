/**
 * Calcule la date d'échéance à partir d'une condition de paiement.
 * endOfMonth : X jours fin de mois (dernier jour du mois après ajout des jours).
 */
export function computeDueDateFromPaymentTerm(
  issueDate: Date,
  days: number,
  endOfMonth: boolean,
): Date {
  const base = new Date(issueDate);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);

  if (!endOfMonth) {
    return base;
  }

  return new Date(base.getFullYear(), base.getMonth() + 1, 0);
}
