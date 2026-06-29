export const AuthMessages = {
  EMAIL_ALREADY_EXISTS:
    'Un compte existe déjà avec cette adresse email.',
  TENANT_NAME_REQUIRED:
    'Le nom de l\'entreprise est obligatoire pour créer un compte.',
  TENANT_NOT_FOUND:
    'Organisation introuvable. Vérifiez l\'identifiant ou indiquez le nom de l\'entreprise.',
  TENANT_TYPE_ON_JOIN_FORBIDDEN:
    'Le type d\'organisation ne peut pas être modifié lors d\'une inscription sur une organisation existante.',
  INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.',
  ACCOUNT_DISABLED:
    'Votre compte est désactivé. Contactez votre administrateur.',
  SESSION_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
  FORGOT_PASSWORD_SENT:
    'Si un compte existe pour cette adresse email, les instructions de réinitialisation ont été envoyées.',
  RESET_TOKEN_INVALID:
    'Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.',
  PASSWORD_UPDATED: 'Votre mot de passe a été mis à jour avec succès.',
  PROFILE_NOT_FOUND: 'Profil introuvable.',
  EMAIL_ALREADY_USED: 'Cette adresse email est déjà utilisée.',
  CURRENT_PASSWORD_INVALID: 'Mot de passe actuel incorrect.',
} as const;
