export const CabinetMessages = {
  ONLY_COMPANY_CAN_GRANT:
    "Seule l'entreprise peut autoriser un cabinet.",
  ONLY_COMPANY_CAN_REVOKE:
    "Seule l'entreprise peut révoquer l'accès d'un cabinet.",
  INVALID_CABINET: 'Cabinet comptable invalide.',
  INVALID_COMPANY: 'Entreprise cliente invalide.',
  COMPANY_ONLY_LIST: 'Liste des cabinets réservée aux entreprises.',
  ACCESS_NOT_FOUND:
    "Aucun accès cabinet n'est enregistré pour cette entreprise.",
  ACCESS_NOT_AUTHORIZED:
    'Accès cabinet non autorisé pour cette entreprise.',
  ACCESS_GRANTED: 'Le cabinet a été autorisé à consulter cette entreprise.',
  ACCESS_REVOKED: "L'accès du cabinet a été révoqué.",
  CABINET_SPACE_ONLY:
    "Cet endpoint est réservé à l'espace cabinet.",
  INVALID_INVITE_CODE: "Code d'invitation cabinet invalide ou expiré.",
  INVITE_IDENTIFIER_REQUIRED:
    'Fournissez un code d\'invitation cabinet ou un identifiant cabinet.',
  SCOPE_INVOICES_DENIED:
    "L'entreprise n'a pas autorisé la consultation des factures pour ce dossier.",
  PERMISSIONS_UPDATED: 'Les droits du cabinet ont été mis à jour.',
} as const;
