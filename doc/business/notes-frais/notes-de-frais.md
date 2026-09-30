# 🧾 Notes de Frais — Politiques, Justificatifs & Remboursement

Ce document décrit les règles métier encadrant la déclaration, le contrôle managérial et le remboursement des frais professionnels engagés par les collaborateurs dans Nexera.

---

## 1. Les Règles Métier Clés

### BM-NDF-001 — Obligation de Pièce Justificative Numérique
- Toute ligne de dépense doit obligatoirement être accompagnée d'un justificatif numérique (photo de facturette, reçu de carte, facture d'hôtel, ticket péage).
- Une note de frais sans justificatif valide ne peut pas être soumise à validation, sauf si la catégorie est expressément paramétrée comme forfaitaire (ex: indemnité kilométrique).

### BM-NDF-002 — Respect des Plafonds de la Politique Entreprise
- L'administrateur définit des plafonds par catégorie de dépense :
  - **Hébergement :** ex: 50 000 FCFA max / nuitée.
  - **Repas d'affaires :** ex: 15 000 FCFA max / personne.
- **Règle de dépassement :**
  - Si le montant dépasse le plafond : la note passe en statut `ALERT_POLICY_EXCEEDED` et exige une justification textuelle obligatoire ainsi qu'une double validation (Manager + Direction Financière).

### BM-NDF-003 — Calcul des Indemnités Kilométriques
- Pour les déplacements effectués avec le véhicule personnel du salarié :
  $$\text{Montant Remboursé} = \text{Distance Parcourue (km)} \times \text{Taux Kilométrique du Véhicule}$$
- Le taux dépend de la puissance fiscale (CV) déclarée et vérifiée dans le profil de l'employé.

### BM-NDF-004 — Séparation des Tâches (Anti-Fraude)
- **Un collaborateur ne peut jamais approuver sa propre note de frais**, même s'il est par ailleurs administrateur ou manager.
- La note d'un manager doit être approuvée par son supérieur hiérarchique direct ($N+1$) ou par la Direction Générale.

---

## 2. Machine à États d'une Note de Frais

```text
               ┌──────────┐
               │  DRAFT   │ (Saisie des dépenses & upload justificatifs)
               └────┬─────┘
                    │ Soumettre
                    ▼
           ┌─────────────────┐
           │    SUBMITTED    │
           └────────┬────────┘
                    │
         ┌──────────┴──────────┐
         │ Validé par N+1      │ Refusé avec motif
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ APPROVED_MGR    │   │    REJECTED     │
└────────┬────────┘   └─────────────────┘
         │
         │ Contrôle Comptable & Fiscal
         ▼
┌─────────────────┐
│ VALIDATED_COMPTA│
└────────┬────────┘
         │
         │ Virement bancaire émis
         ▼
┌─────────────────┐
│      PAID       │ ◄─── Soldée définitivement
└─────────────────┘
```

---

## 3. Scénarios Métier Vérifiables (BDD / Gherkin)

```gherkin
Fonctionnalité : Soumission de Note de Frais

Scénario : Refus de soumission sans reçu justificatif
  Étant donné une dépense de 45 000 FCFA dans la catégorie "Restaurant"
  Mais sans aucun fichier justificatif attaché
  Quand le salarié tente de soumettre la note de frais
  Alors le système bloque la soumission avec l'erreur "RECEIPT_ATTACHMENT_REQUIRED"
  Et la note reste au statut "DRAFT"

Scénario : Dépassement de plafond exigeant justification
  Étant donné un plafond hôtel fixé à 40 000 FCFA par nuitée
  Et une nuitée déclarée à 55 000 FCFA avec reçu
  Quand le collaborateur soumet la note
  Alors le système exige un motif d'exception ("Justification du dépassement")
  Et la note est marquée avec l'étiquette "PLAFOND_DÉPASSÉ" pour alerte du valideur
```

---

## 4. Dictionnaire des Erreurs Notes de Frais

| Code d'erreur | Description |
|---|---|
| `RECEIPT_ATTACHMENT_REQUIRED` | Une pièce justificative est requise pour cette catégorie |
| `CANNOT_APPROVE_OWN_EXPENSE` | Interdiction formelle d'approuver sa propre note de frais |
| `EXPENSE_ALREADY_PAID` | La note de frais a déjà été remboursée et ne peut être modifiée |
| `INVALID_KILOMETRIC_RATE` | Le taux kilométrique n'est pas renseigné ou est invalide |
