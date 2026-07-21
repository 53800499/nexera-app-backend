import { NumberingDocumentType } from '../enums/numbering-document-type.enum';
import { EmailTemplateType } from '../enums/email-template-type.enum';

export const DEFAULT_NUMBERING_RULES: Array<{
  documentType: NumberingDocumentType;
  prefix: string;
  draftMarker?: string;
  includeYear: boolean;
  counterLength: number;
  annualReset: boolean;
}> = [
  {
    documentType: NumberingDocumentType.QUOTATION,
    prefix: 'DEV',
    includeYear: true,
    counterLength: 6,
    annualReset: true,
  },
  {
    documentType: NumberingDocumentType.ORDER_DRAFT,
    prefix: 'BC',
    draftMarker: 'DRAFT',
    includeYear: false,
    counterLength: 6,
    annualReset: false,
  },
  {
    documentType: NumberingDocumentType.ORDER_ISSUED,
    prefix: 'BC',
    includeYear: true,
    counterLength: 6,
    annualReset: true,
  },
  {
    documentType: NumberingDocumentType.INVOICE_DRAFT,
    prefix: 'FAC',
    draftMarker: 'DRAFT',
    includeYear: false,
    counterLength: 6,
    annualReset: false,
  },
  {
    documentType: NumberingDocumentType.INVOICE_ISSUED,
    prefix: 'FAC',
    includeYear: true,
    counterLength: 6,
    annualReset: true,
  },
  {
    documentType: NumberingDocumentType.CLIENT,
    prefix: 'CLT',
    includeYear: false,
    counterLength: 6,
    annualReset: false,
  },
  {
    documentType: NumberingDocumentType.CATALOG_ITEM,
    prefix: 'ART',
    includeYear: false,
    counterLength: 6,
    annualReset: false,
  },
  {
    documentType: NumberingDocumentType.STOCK_RECEIPT,
    prefix: 'BRE',
    includeYear: true,
    counterLength: 6,
    annualReset: true,
  },
  {
    documentType: NumberingDocumentType.STOCK_ISSUE,
    prefix: 'BST',
    includeYear: true,
    counterLength: 6,
    annualReset: true,
  },
];

export const DEFAULT_TAX_RATES = [
  { name: 'Exonéré', rate: 0, isDefault: false },
  { name: 'TVA 10%', rate: 10, isDefault: false },
  { name: 'TVA 18%', rate: 18, isDefault: true },
  { name: 'TVA 20%', rate: 20, isDefault: false },
];

export const DEFAULT_PAYMENT_TERMS = [
  { name: 'Comptant', days: 0, endOfMonth: false, isDefault: false },
  { name: '30 jours', days: 30, endOfMonth: false, isDefault: true },
  { name: '60 jours', days: 60, endOfMonth: false, isDefault: false },
  {
    name: '30 jours fin de mois',
    days: 30,
    endOfMonth: true,
    isDefault: false,
  },
];

export const DEFAULT_EMAIL_TEMPLATES: Array<{
  type: EmailTemplateType;
  subject: string;
  body: string;
}> = [
  {
    type: EmailTemplateType.QUOTATION_SEND,
    subject: 'Devis {{documentNumber}}',
    body:
      'Bonjour {{clientName}},\n\n' +
      'Veuillez trouver ci-joint le devis {{documentNumber}}.\n' +
      'Téléchargement : {{downloadUrl}}\n\n{{message}}',
  },
  {
    type: EmailTemplateType.INVOICE_SEND,
    subject: 'Facture {{documentNumber}} — {{amountDue}} {{currency}}',
    body:
      'Bonjour {{clientName}},\n\n' +
      'Veuillez trouver ci-joint la facture {{documentNumber}} d\'un montant de {{amountDue}} {{currency}}.\n' +
      'Échéance : {{dueDate}}\n\n' +
      'Téléchargement sécurisé : {{downloadUrl}}\n\n{{message}}',
  },
  {
    type: EmailTemplateType.REMINDER_LEVEL_1,
    subject: 'Rappel facture {{invoiceNumber}}',
    body:
      'Bonjour,\n\nNous vous contactons concernant la facture {{invoiceNumber}} ' +
      "d'un montant de {{amountDue}} {{currency}}, échue le {{dueDate}}.\n\n" +
      'Merci de procéder au règlement dans les meilleurs délais.\n\nCordialement',
  },
  {
    type: EmailTemplateType.REMINDER_LEVEL_2,
    subject: 'Relance — facture {{invoiceNumber}}',
    body:
      'Madame, Monsieur,\n\nMalgré notre précédent rappel, la facture {{invoiceNumber}} ' +
      'demeure impayée.\n\nRécapitulatif :\n{{openInvoicesRecap}}\n\n' +
      'Merci de régulariser sous 8 jours.\n\nCordialement',
  },
  {
    type: EmailTemplateType.REMINDER_LEVEL_3,
    subject: 'Mise en demeure — facture {{invoiceNumber}}',
    body:
      'MISE EN DEMEURE\n\nLa facture {{invoiceNumber}} ({{amountDue}} {{currency}}, ' +
      'échue le {{dueDate}}) demeure impayée.\n\n' +
      'À défaut de règlement sous 8 jours, des procédures de recouvrement seront engagées.',
  },
  {
    type: EmailTemplateType.RECURRING_INVOICE,
    subject: 'Facture récurrente à valider — échéance {{executionDate}}',
    body:
      'Bonjour,\n\nUn brouillon de facture a été généré pour {{clientName}}.\n' +
      'Modèle : {{templateNumber}}\nBrouillon : {{draftNumber}}\n' +
      'Échéance prévue : {{executionDate}}\n\nVeuillez valider et émettre la facture.',
  },
];

export const DEFAULT_LATE_PAYMENT_TEXT =
  'En cas de retard de paiement, une pénalité de {{penaltyRate}}% l\'an sera appliquée, conformément à la réglementation en vigueur.';
