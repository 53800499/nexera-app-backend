export enum QuotationStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CONVERTED = 'converted',
}

export const EDITABLE_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.SENT,
  QuotationStatus.VIEWED,
];
