export const AuthMessages = {
  EMAIL_ALREADY_EXISTS:
    "Un compte existe déjà avec cette adresse e-mail. Connectez-vous directement ou cliquez sur « Mot de passe oublié ».",
  TENANT_NAME_REQUIRED:
    "Le nom de l'entreprise est obligatoire pour créer votre espace de travail.",
  TENANT_NOT_FOUND:
    "Organisation introuvable. Vérifiez votre lien d'invitation ou renseignez le nom de votre entreprise pour en créer une.",
  TENANT_TYPE_ON_JOIN_FORBIDDEN:
    "Le type d'organisation ne peut pas être modifié lors de l'adhésion à une organisation existante.",
  TENANT_SUSPENDED:
    "L'accès à votre entreprise est temporairement suspendu. Veuillez contacter votre administrateur ou le support Nexera.",
  INVALID_CREDENTIALS:
    'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants ou utilisez la réinitialisation de mot de passe.',
  ACCOUNT_DISABLED:
    'Votre compte utilisateur est désactivé ou suspendu. Veuillez contacter l’administrateur de votre entreprise ou le support.',
  SESSION_EXPIRED:
    'Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter.',
  FORGOT_PASSWORD_SENT:
    'Si un compte existe pour cette adresse e-mail, les instructions de réinitialisation vous ont été envoyées.',
  RESET_TOKEN_INVALID:
    'Le lien de réinitialisation est invalide ou a expiré (durée de validité : 60 minutes). Veuillez demander un nouveau lien.',
  PASSWORD_UPDATED:
    'Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.',
  PROFILE_NOT_FOUND: 'Profil utilisateur introuvable.',
  EMAIL_ALREADY_USED:
    'Cette adresse e-mail est déjà associée à un autre compte.',
  CURRENT_PASSWORD_INVALID:
    'Le mot de passe actuel saisi est incorrect. Veuillez vérifier votre saisie.',
} as const;
