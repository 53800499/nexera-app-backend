import { PdfLayoutType } from '@prisma/client';

export interface PdfAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface PdfSellerInfo {
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  shareCapital?: string | null;
  address?: PdfAddress | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface PdfBuyerInfo {
  companyName: string;
  tradeName?: string | null;
  siret?: string | null;
  taxId?: string | null;
  billingAddress?: PdfAddress | null;
}

export interface PdfDocumentLine {
  position: number;
  description: string;
  quantity: number;
  unitPriceHt: number;
  lineTotalHt: number;
  taxRate: number;
  taxRateName?: string;
  taxAmount: number;
  lineTotalTtc: number;
}

export interface PdfTaxBreakdown {
  rate: number;
  rateName?: string;
  baseHt: number;
  taxAmount: number;
}

export interface PdfTemplateConfig {
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  layoutType: PdfLayoutType;
  showPageNumbers: boolean;
  headerText?: string | null;
  footerText?: string | null;
  legalMentions?: string | null;
  termsAndConditions?: string | null;
}

export interface PdfDocumentInput {
  documentType: 'invoice' | 'quotation' | 'credit_note';
  documentLabel: string;
  number: string;
  issueDate: Date;
  dueDate?: Date | null;
  currency: string;
  seller: PdfSellerInfo;
  buyer: PdfBuyerInfo;
  lines: PdfDocumentLine[];
  subtotalHt: number;
  discountPct: number;
  discountAmount: number;
  baseHt: number;
  taxBreakdown: PdfTaxBreakdown[];
  totalTax: number;
  totalTtc: number;
  paymentTerms?: string | null;
  acceptedPaymentMethods?: string | null;
  latePaymentMention?: string | null;
  notes?: string | null;
  template: PdfTemplateConfig;
}
