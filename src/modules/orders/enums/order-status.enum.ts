/**
 * Statuts bon de commande (UC-04).
 * Valeurs persistées = enum Prisma OrderStatus.
 */
export enum OrderStatus {
  /** Brouillon — BC créé non confirmé */
  DRAFT = 'draft',
  /** Confirmé — BC validé, numéro définitif attribué (RM-BC01) */
  CONFIRMED = 'confirmed',
  /** En cours — au moins une facture partielle (RM-BC02) */
  IN_PROGRESS = 'partially_paid',
  /** Facturé — 100 % du montant BC facturé */
  FULLY_BILLED = 'paid',
  /** Annulé — uniquement sans facture */
  CANCELLED = 'cancelled',
}

export const EDITABLE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.DRAFT];
