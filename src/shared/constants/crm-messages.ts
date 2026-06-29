export const CrmMessages = {
  client: {
    NOT_FOUND: 'Client introuvable.',
    CODE_IMMUTABLE: 'Le code client ne peut pas être modifié.',
    CONTACT_NOT_FOUND: 'Contact introuvable.',
    LAST_CONTACT: 'Impossible de supprimer le dernier contact du client.',
    DUPLICATE_EMAIL: 'Un contact avec cette adresse email existe déjà.',
    ADDRESS_INVALID: (field: string) =>
      `L'adresse « ${field} » doit être un objet JSON non vide.`,
    ARCHIVE_HAS_TRANSACTIONS:
      "Impossible d'archiver ce client : des devis, commandes, factures ou paiements y sont liés.",
  },
  catalogue: {
    CATEGORY_NOT_FOUND: 'Catégorie introuvable.',
    ITEM_NOT_FOUND: 'Article introuvable.',
    PRICE_NOT_FOUND: 'Tarif introuvable.',
    PRICE_NEGATIVE: 'Le prix HT ne peut pas être négatif.',
    TAX_RATE_NOT_FOUND:
      'Taux de TVA introuvable ou inactif pour votre organisation.',
    REFERENCE_EXISTS: 'Cette référence article existe déjà.',
    CATEGORY_HAS_ITEMS:
      'Impossible de supprimer une catégorie qui contient encore des articles.',
    ITEM_USED_IN_TRANSACTIONS:
      "Cet article est utilisé dans des transactions ; vous pouvez uniquement l'archiver.",
  },
  quotation: {
    NOT_FOUND: 'Devis introuvable.',
    NOT_EDITABLE: 'Ce devis ne peut pas être modifié dans son état actuel.',
    ONLY_DRAFT_DELETE: 'Seuls les devis en brouillon peuvent être supprimés.',
    ONLY_DRAFT_SEND: 'Seuls les devis en brouillon peuvent être envoyés.',
    PDF_NOT_FOUND: 'PDF du devis introuvable.',
    ONLY_ACCEPTED_CONVERT:
      'Seuls les devis acceptés peuvent être convertis en commande.',
    CLIENT_NOT_FOUND: 'Client introuvable pour votre organisation.',
    CLIENT_BLOCKED:
      'Client bloqué pour les nouveaux devis (factures impayées en mise en demeure).',
    CONTACT_NOT_FOUND: 'Contact introuvable pour ce client.',
    PAYMENT_TERM_NOT_FOUND: 'Condition de paiement introuvable.',
    STATUS_TRANSITION: (from: string, to: string) =>
      `Impossible de passer le devis de « ${from} » à « ${to} ».`,
    TAX_RATE_NOT_FOUND: (id: string) => `Taux de TVA introuvable (${id}).`,
    CATALOG_ITEM_NOT_FOUND: (id: string) =>
      `Article catalogue introuvable (${id}).`,
    DISCOUNT_EXCEEDS_MAX: (reference: string) =>
      `La remise dépasse le maximum autorisé pour l'article ${reference}.`,
  },
  order: {
    NOT_FOUND: 'Bon de commande introuvable.',
    ONLY_DRAFT_MODIFY:
      'Seuls les bons de commande en brouillon peuvent être modifiés.',
    ONLY_DRAFT_CONFIRM:
      'Seuls les bons de commande en brouillon peuvent être confirmés.',
    ALREADY_CANCELLED: 'Ce bon de commande est déjà annulé.',
    CANNOT_CANCEL_WITH_INVOICES:
      "Impossible d'annuler un bon de commande déjà facturé.",
    ONLY_DRAFT_DELETE:
      'Seuls les bons de commande en brouillon peuvent être supprimés.',
    CANNOT_DELETE_WITH_INVOICES:
      'Impossible de supprimer un bon de commande lié à des factures.',
    MUST_CONFIRM_BEFORE_INVOICE:
      'Le bon de commande doit être confirmé avant facturation.',
    ALREADY_FULLY_BILLED: 'Ce bon de commande est déjà entièrement facturé.',
    AMOUNT_EXCEEDS_REMAINING: (remaining: string | number) =>
      `Le montant dépasse le reste à facturer (${remaining}).`,
    INVOICE_AMOUNT_POSITIVE: 'Le montant à facturer doit être supérieur à 0.',
    CLIENT_NOT_FOUND: 'Client introuvable pour votre organisation.',
    CLIENT_BLOCKED:
      'Client bloqué pour les nouvelles commandes (factures impayées en mise en demeure).',
    QUOTATION_NOT_FOUND: 'Devis introuvable.',
    QUOTATION_CLIENT_MISMATCH:
      "Le devis sélectionné n'appartient pas au client choisi.",
    TAX_RATE_NOT_FOUND: (id: string) => `Taux de TVA introuvable (${id}).`,
    CATALOG_ITEM_NOT_FOUND: (id: string) =>
      `Article catalogue introuvable (${id}).`,
  },
  invoice: {
    NOT_FOUND: 'Facture introuvable.',
    USE_CREDIT_NOTE_ENDPOINT:
      "Utilisez l'endpoint d'avoir pour créer une note de crédit.",
    ORDER_FULLY_BILLED: 'Ce bon de commande est déjà entièrement facturé.',
    AMOUNT_EXCEEDS_REMAINING: (remaining: string | number) =>
      `Le montant dépasse le reste à facturer (${remaining}).`,
    ONLY_DRAFT_MODIFY:
      'Seules les factures en brouillon peuvent être modifiées.',
    ONLY_DRAFT_ISSUE: 'Seules les factures en brouillon peuvent être émises.',
    MUST_ISSUE_BEFORE_SEND: "La facture doit être émise avant d'être envoyée.",
    PDF_NOT_FOUND: 'PDF de la facture introuvable.',
    CREDIT_ON_CREDIT_NOTE:
      'Impossible de créer un avoir sur un avoir existant.',
    CREDIT_REQUIRES_ISSUED:
      'Un avoir ne peut être créé que sur une facture émise.',
    CREDIT_EXCEEDS_ORIGINAL: (maxAmount: string | number) =>
      `Le montant de l\'avoir ne peut pas dépasser le montant d\'origine (${maxAmount}).`,
    ONLY_DRAFT_DELETE:
      'Seules les factures en brouillon peuvent être supprimées.',
    TEMPLATE_NOT_FOUND: 'Modèle de facture introuvable.',
    CREDIT_NOT_RECURRING_TEMPLATE:
      'Un avoir ne peut pas servir de modèle de facturation récurrente.',
    CLIENT_NOT_FOUND: 'Client introuvable.',
    ORDER_NOT_FOUND: 'Bon de commande introuvable.',
    ORDER_CLIENT_MISMATCH:
      'Le bon de commande ne correspond pas au client sélectionné.',
    QUOTATION_NOT_FOUND: 'Devis introuvable.',
    TAX_RATE_NOT_FOUND: (id: string) => `Taux de TVA introuvable (${id}).`,
  },
  payment: {
    NOT_FOUND: 'Paiement introuvable.',
    CLIENT_NOT_FOUND: 'Client introuvable.',
    EXCEEDS_AMOUNT_DUE: (amountDue: string | number) =>
      `Le paiement dépasse le montant dû (${amountDue}).`,
    ALREADY_CANCELLED: 'Ce paiement est déjà annulé.',
    CANNOT_CANCEL_APPLIED_ADVANCE:
      "Impossible d'annuler un acompte déjà imputé sur des factures.",
    ALLOCATION_REQUIRED:
      'Une imputation manuelle nécessite au moins une ligne.',
    INVOICE_NOT_OPEN: (invoiceId: string) =>
      `La facture ${invoiceId} n'est pas ouverte pour ce client.`,
    IMPUTATION_EXCEEDS_DUE: (invoiceNumber: string) =>
      `L'imputation dépasse le montant dû sur la facture ${invoiceNumber}.`,
    IMPUTATIONS_EXCEED_PAYMENT:
      'Le total des imputations dépasse le montant du paiement.',
    INVOICE_NOT_FOUND: 'Facture introuvable.',
    PROFORMA_NOT_PAYABLE:
      'Les factures pro forma ne peuvent pas être encaissées.',
    INVOICE_NOT_OPEN_FOR_PAYMENT:
      "Cette facture n'est pas ouverte aux encaissements.",
    NO_AMOUNT_DUE: "Cette facture n'a plus de montant à payer.",
  },
} as const;
