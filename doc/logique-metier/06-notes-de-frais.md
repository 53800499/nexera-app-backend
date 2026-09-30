# 🧾 06 — Notes de Frais & Politiques de Dépense

Ce document décrit la logique métier backend du module `notes-frais`.

---

## 1. Workflow de Validation Multi-Niveaux

Une note de frais suit un cycle de validation rigoureux :

```text
[ DRAFT ] ──(Soumettre)──► [ SUBMITTED ]
                                │
                                ├──(Rejet Manager)──► [ REJECTED ]
                                │
                                ▼
                        [ APPROVED_MGR ]
                                │
                                ├──(Rejet Comptabilité)──► [ REJECTED ]
                                │
                                ▼
                      [ VALIDATED_COMPTA ]
                                │
                                ▼ (Paiement Virement)
                            [ PAID ]
```

---

## 2. Règles Métier de Contrôle

### A. Séparation des Tâches (Anti-Fraude)
Un collaborateur ne peut en aucun cas approuver sa propre note de frais :
```typescript
if (expenseReport.userId === currentUserId) {
  throw new ForbiddenException('CANNOT_APPROVE_OWN_EXPENSE: Vous ne pouvez pas valider votre propre note de frais.');
}
```

### B. Contrôle des Plafonds de Dépense
Si le montant d'une dépense dépasse le plafond paramétré dans la politique de l'entreprise :
- La note est automatiquement flagguée `POLICY_EXCEEDED`.
- Une justification textuelle devient obligatoire.
- Une double approbation (Manager + Direction Financière) est requise pour autoriser le remboursement.

### C. Calcul des Indemnités Kilométriques
Pour les frais de déplacement avec véhicule personnel :
$$\text{Montant} = \text{Kilomètres Déclarés} \times \text{Taux Kilométrique du Véhicule}$$
Le backend vérifie que le barème utilisé correspond à la puissance fiscale validée dans le dossier de l'employé.
