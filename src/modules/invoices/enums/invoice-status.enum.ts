/**
 * Statuts facture (UC-05). Valeurs = enum Prisma InvoiceStatus.
 * NORM (normalisée DGI) : prévu — intégration QR à venir.
 */
export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  SENT = 'sent',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export const EDITABLE_INVOICE_STATUSES: InvoiceStatus[] = [InvoiceStatus.DRAFT];

export const ISSUED_IMMUTABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];
