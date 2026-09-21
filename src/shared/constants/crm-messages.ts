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
    ACTIVATED: 'Client réactivé avec succès.',
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
  stock: {
    WAREHOUSE_NOT_FOUND: 'Entrepôt introuvable.',
    LOCATION_NOT_FOUND: 'Emplacement introuvable.',
    STOCK_ITEM_NOT_FOUND: 'Configuration stock introuvable.',
    CATALOG_ITEM_NOT_FOUND:
      'Article catalogue introuvable pour votre organisation.',
    CATALOG_ITEM_NOT_PRODUCT:
      'Seuls les articles de type produit peuvent avoir une configuration stock.',
    STOCK_ITEM_EXISTS:
      'Une configuration stock existe déjà pour cet article.',
    WAREHOUSE_CODE_EXISTS: 'Ce code entrepôt existe déjà.',
    WAREHOUSE_CODE_IMMUTABLE:
      'Le code entrepôt ne peut pas être modifié après création.',
    WAREHOUSE_HAS_STOCK:
      'Cet entrepôt contient encore du stock. Transférez le stock avant archivage.',
    WAREHOUSE_DEFAULT_REQUIRED:
      'Un entrepôt par défaut est obligatoire. Désignez un autre entrepôt principal avant.',
    WAREHOUSE_ARCHIVED:
      'Cet entrepôt est archivé : aucune modification d’emplacement possible.',
    LOCATION_CODE_EXISTS: 'Ce code emplacement existe déjà.',
    LOCATION_CODE_IMMUTABLE:
      'Le code emplacement et sa hiérarchie ne peuvent pas être modifiés après création.',
    LOCATION_HIERARCHY_REQUIRED:
      'Zone, allée, rayon et case sont obligatoires pour créer un emplacement.',
    LOCATION_WAREHOUSE_MISMATCH:
      "L'emplacement n'appartient pas à l'entrepôt sélectionné.",
    THRESHOLDS_INVALID:
      'Seuils incohérents : stock de sécurité ≤ stock minimum ≤ stock maximum.',
    CONVERSION_FACTOR_INVALID:
      'Le facteur de conversion doit être strictement positif.',
    VALUATION_METHOD_IMMUTABLE:
      'La méthode de valorisation ne peut pas être modifiée tant que le stock est positif.',
    MOVEMENT_NOT_FOUND: 'Mouvement de stock introuvable.',
    MOVEMENT_ALREADY_VALIDATED: 'Ce mouvement a déjà été validé.',
    MOVEMENT_CANCELLED: 'Ce mouvement est annulé.',
    MOVEMENT_NOT_ENTRY: "Ce mouvement n'est pas une entrée de stock.",
    QTY_POSITIVE_REQUIRED:
      'La quantité doit être strictement supérieure à 0.',
    QTY_ACTUAL_EXCEEDS:
      'La quantité acceptée ne peut pas dépasser la quantité reçue.',
    UNIT_COST_NEGATIVE: 'Le coût unitaire ne peut pas être négatif.',
    REASON_REQUIRED:
      'Un motif est obligatoire pour un ajustement positif.',
    LOT_REQUIRED:
      'Un numéro de lot est obligatoire pour cet article.',
    LOT_DUPLICATE:
      'Ce numéro de lot a déjà été réceptionné pour cet article.',
    SERIAL_COUNT_MISMATCH:
      'Le nombre de numéros de série saisis doit correspondre exactement à la quantité.',
    EXPIRY_REQUIRED:
      'La date de péremption est obligatoire pour cet article.',
    INITIAL_ENTRY_ONCE:
      'Le stock initial ne peut être saisi qu’une seule fois par article.',
    INSUFFICIENT_STOCK:
      'Quantité en stock insuffisante pour effectuer cette sortie.',
    INSUFFICIENT_STOCK_DETAIL: (
      article: string,
      warehouse: string,
      available: number,
      requested: number,
    ) =>
      `Quantité en stock insuffisante pour « ${article} » dans l'entrepôt « ${warehouse} » : disponible ${available}, demandé ${requested}.`,
    COST_CENTER_REQUIRED:
      'Le centre de coût est obligatoire pour une sortie consommation.',
    LOSS_REASON_REQUIRED:
      'Un motif détaillé est obligatoire pour une perte / ajustement négatif.',
    LOSS_REQUIRES_APPROVAL:
      'Cette perte dépasse le seuil autorisé : validation par un responsable requise. Enregistrez en brouillon puis demandez la validation.',
    LOT_REQUIRED_OUT:
      'Veuillez sélectionner le lot à sortir pour cet article.',
    SERIAL_REQUIRED_OUT:
      'Veuillez renseigner les numéros de série correspondant aux articles à sortir.',
    SERIAL_NOT_IN_STOCK:
      'Un ou plusieurs numéros de série ne sont pas disponibles en stock.',
    SERIAL_ALREADY_EXISTS: (sn: string) =>
      `Le numéro de série « ${sn} » a déjà été enregistré pour cet article.`,
    SERIAL_DUPLICATE_IN_INPUT: (sn: string) =>
      `Le numéro de série « ${sn} » est saisi plusieurs fois dans votre liste.`,
    SERIAL_NOT_FOUND: (sn: string) =>
      `Le numéro de série « ${sn} » n'existe pas dans le stock de cet article.`,
    SERIAL_ALREADY_SOLD: (sn: string) =>
      `Le numéro de série « ${sn} » a déjà été vendu ou sorti du stock.`,
    SERIAL_ALREADY_SCRAPPED: (sn: string) =>
      `Le numéro de série « ${sn} » a déjà été mis au rebut.`,
    SERIAL_ALREADY_TRANSFERRED: (sn: string) =>
      `Le numéro de série « ${sn} » a déjà été transféré.`,
    SERIAL_WRONG_WAREHOUSE: (sn: string) =>
      `Le numéro de série « ${sn} » se trouve dans un autre entrepôt.`,
    DRAFT_LINE_NOT_FOUND:
      'Ligne de mouvement introuvable dans ce brouillon.',
    DRAFT_ONLY_ACTION:
      'Cette modification est autorisée uniquement sur un mouvement en brouillon.',
    MOVEMENT_NOT_EXIT: "Ce mouvement n'est pas une sortie de stock.",
    EXIT_ALREADY_FOR_INVOICE:
      'Une sortie de stock existe déjà pour cette facture.',
    TRANSFER_NOT_FOUND: 'Transfert introuvable.',
    TRANSFER_SAME_WAREHOUSE:
      'L’entrepôt source et l’entrepôt destination doivent être distincts.',
    TRANSFER_INVALID_STATUS:
      'Cette action n’est pas autorisée pour le statut actuel du transfert.',
    TRANSFER_VARIANCE_REASON_REQUIRED:
      'Un motif d’écart est obligatoire lorsque la quantité reçue diffère de la quantité expédiée.',
    TRANSFER_ALREADY_SHIPPED: 'Ce transfert a déjà été expédié.',
    TRANSFER_NOT_IN_TRANSIT:
      'Seuls les transferts en transit peuvent être réceptionnés.',
    TRANSFER_CANCEL_AFTER_SHIP:
      'Impossible d’annuler un transfert déjà expédié.',
    INVENTORY_NOT_FOUND: 'Session d’inventaire introuvable.',
    INVENTORY_INVALID_STATUS:
      'Cette action n’est pas autorisée pour le statut actuel de l’inventaire.',
    INVENTORY_NO_LINES:
      'Aucun article à inventarier pour ce périmètre.',
    INVENTORY_COUNT_INCOMPLETE:
      'Toutes les lignes doivent être comptées avant de poursuivre.',
    INVENTORY_RECOUNT_INCOMPLETE:
      'Les lignes en double comptage doivent être saisies (2e comptage).',
    INVENTORY_MOVEMENTS_FROZEN:
      'Les mouvements de stock sont temporairement bloqués car un inventaire est en cours sur cet entrepôt.',
    INVENTORY_CATEGORY_REQUIRED:
      'Une catégorie est obligatoire pour un inventaire partiel.',
    ALERT_NOT_FOUND: 'Alerte stock introuvable.',
    ALERT_INVALID_STATUS:
      'Cette action n’est pas autorisée pour le statut actuel de l’alerte.',
    REPLENISHMENT_NOT_FOUND: 'Proposition de réapprovisionnement introuvable.',
    REPLENISHMENT_INVALID_STATUS:
      'Cette action n’est pas autorisée pour le statut actuel de la proposition.',
    REPLENISHMENT_ALREADY_EXISTS:
      'Une proposition de réapprovisionnement est déjà en cours pour cette alerte.',
  },
} as const;
