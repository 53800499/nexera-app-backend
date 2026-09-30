# 📊 05 — Fiscalité, Déclarations TVA & Export FEC

Ce document détaille la logique métier et les calculs des modules `fiscalite` et `exports`.

---

## 1. Détermination du Solde Mensuel de TVA

Le service fiscal calcule la position de TVA pour un mois $M$ :

$$\text{TVA Brute} = \sum \text{TVA sur Factures Clients Validées}$$
$$\text{TVA Déductible} = \sum \text{TVA Achats Fournisseurs avec IFU valide} + \sum \text{TVA Immobilisations}$$
$$\text{Solde Avant Report} = \text{TVA Brute} - \text{TVA Déductible}$$
$$\text{Solde Net} = \text{Solde Avant Report} - \text{Crédit Reporté du Mois } M-1$$

### Règles Métier :
- **Si Solde Net > 0 :** Montant à décaisser au Trésor Public avant le 15 du mois $M+1$.
- **Si Solde Net < 0 :** Constatation d'un nouveau **Crédit de TVA** reporté automatiquement sur le mois $M+1$.
- **Exclusion des Achats sans IFU :** Toute facture fournisseur dont le numéro IFU est manquant ou invalide est exclue de la TVA déductible par le service backend.

---

## 2. Génération du Fichier des Écritures Comptables (FEC)

Le module `exports` génère le fichier normalisé pour l'administration fiscale et les commissaires aux comptes :
- **Format :** Fichier plat encodé en UTF-8 avec séparateur tabulation (`\t`) ou pipe (`|`).
- **18 colonnes obligatoires conformes aux arrêtés légaux :**
  1. `JournalCode` (ex: VE, AC, BQ, OD)
  2. `JournalLib` (ex: Journal des Ventes)
  3. `EcritureNum` (Numéro séquentiel unique d'écriture)
  4. `EcritureDate` (Date comptable AAAA-MM-JJ)
  5. `CompteNum` (Plan comptable OHADA : ex: 411100, 701100, 445200)
  6. `CompteLib` (Libellé du compte)
  7. `CompAuxNum` / `CompAuxLib` (Compte tiers client/fournisseur)
  8. `PieceRef` (Numéro de facture ou pièce justificative)
  9. `PieceDate` (Date d'émission de la pièce)
  10. `EcritureLib` (Libellé descriptif de l'opération)
  11. `Debit` (Montant débit au franc près)
  12. `Credit` (Montant crédit au franc près)
  13. `EcritureLet` (Code de lettrage pour réconciliation)
  14. `DateLet` (Date de lettrage)
  15. `ValidDate` (Date de validation définitive)
  16. `Montantdevise` / `Idevise` (Si monnaie étrangère)

> 🔒 **Contrôle d'Équilibre :** Le service vérifie que $\sum \text{Débits} = \sum \text{Crédits}$ avant de valider l'export. Si l'écriture est déséquilibrée, la génération est bloquée avec l'erreur `FEC_UNBALANCED_ENTRIES`.
 
---

## 3. Architecture Complète & Interconnexions Inter-Modules

Pour l'architecture exhaustive du moteur fiscal (schéma PostgreSQL `tax`, modèle d'événements `TaxEvenementSource`, contrats inter-modules M1-M7, barèmes versionnés, arrêtés d'IS SYSCOHADA et télétransmission EDI DGI), se référer à :
- 📘 [Spécification d'Architecture & Guide Métier Module 7 — Fiscalité](../business/fiscalite/NEXERA_M7_Fiscalite_Architecture_Interconnexions_Metier.md)

