# 💼 Cycle Commercial & Ventes — Devis, Factures, Règlements & Avoirs

Ce document décrit l'ensemble de la logique métier régissant la vente de produits et services dans Nexera.

---

## 1. Les Règles Métier Clés

### BM-COM-001 — Cycle de vie du Devis
- Un devis est créé à l'état `DRAFT` (Brouillon). Il est modifiable sans restriction.
- Dès son envoi au client (`SENT`), il ne doit plus être altéré unilatéralement.
- Un devis a une **date de validité**. Si cette date est dépassée sans réponse, son statut devient `EXPIRED`.
- Un devis peut être `ACCEPTED` (Accepté) ou `REJECTED` (Refusé).
- **Seul un devis au statut `ACCEPTED` peut être converti en Bon de Commande ou Facture.**

### BM-COM-002 — Immuabilité de la Facture Validée
- **Dès qu'une facture passe au statut `ISSUED` (Émise / Validée) :**
  - Elle reçoit un numéro séquentiel définitif et inaltérable.
  - **Toute modification (lignes, montants, client, taux de taxe) est STRICTEMENT INTERDITE.**
  - **La suppression (DELETE physique ou logique) est STRICTEMENT INTERDITE.**
- Une facture émise ne peut être annulée ou rectifiée que par l'émission d'un **Avoir (Note de crédit)**.

### BM-COM-003 — Règle de l'Avoir (Credit Note)
- Un avoir doit obligatoirement être rattaché à une facture d'origine validée.
- Le montant d'un avoir ne peut en aucun cas dépasser le montant restant de la facture d'origine :
  $$\sum \text{Montant Avoirs} \le \text{Montant TTC Facture}$$
- L'émission d'un avoir recalcule immédiatement le solde dû par le client.

### BM-COM-004 — Numérotation Séquentielle sans Rupture
- Les numéros de factures et d'avoirs doivent être continus, chronologiques et sans trou (ex: `FA-2026-0001`, `FA-2026-0002`).
- En cas de facture annulée par avoir, le numéro de facture ne doit pas être réutilisé ni réassigné.

### BM-COM-005 — Suivi des Règlements et Statuts de Paiement
- Une facture émise est initialement `UNPAID` (Non payée).
- Un paiement partiel passe la facture à l'état `PARTIALLY_PAID`.
- Dès que le cumul des paiements reçus égale le montant total TTC diminué des avoirs, la facture passe à `PAID`.
- Si la date d'échéance (`dueDate`) est dépassée et que le solde restant est supérieur à 0, la facture est considérée `OVERDUE`.
- Le montant d'un paiement ne peut excéder le solde restant dû :
  $$\text{Montant Paiement} \le \text{Total TTC Facture} - \text{Cumul Déjà Payé} - \text{Cumul Avoirs}$$

---

## 2. Machine à États (State Machines)

### Cycle du Devis (Quotation)
```text
               ┌──────────┐
               │  DRAFT   │
               └────┬─────┘
                    │ Envoyer au client
                    ▼
               ┌──────────┐
      ┌─────── │   SENT   │ ────────┐
      │        └────┬─────┘         │
      │ Accepté     │ Refusé        │ Date dépassée
      ▼             ▼               ▼
┌──────────┐  ┌──────────┐    ┌──────────┐
│ ACCEPTED │  │ REJECTED │    │ EXPIRED  │
└────┬─────┘  └──────────┘    └──────────┘
     │
     ▼
[ Conversion en Facture ]
```

### Cycle de la Facture (Invoice)
```text
           ┌──────────┐
           │  DRAFT   │
           └────┬─────┘
                │ Valider & Émettre
                ▼
           ┌──────────┐
           │  ISSUED  │ ◄────── IMMUABLE (Non modifiable, non supprimable)
           └────┬─────┘
                │
     ┌──────────┴──────────┐
     │ Paiement partiel    │ Paiement total
     ▼                     ▼
┌──────────────────┐  ┌──────────┐
│  PARTIALLY_PAID  │  │   PAID   │
└────────┬─────────┘  └──────────┘
         │ Paiement du solde
         └─────────►
```

#### Transitions Interdites ❌
- `ISSUED` ➔ `DRAFT` : **Interdit**.
- `PAID` ➔ `DRAFT` : **Interdit**.
- `PAID` ➔ `UNPAID` : **Interdit** (sauf annulation explicite du paiement via flux d'audit).

---

## 3. Formules de Calcul Financier

Pour chaque ligne $i$ :
$$\text{Total Brut Ligne}_i = \text{Quantité}_i \times \text{Prix Unitaire HT}_i$$
$$\text{Remise Ligne}_i = \text{Total Brut Ligne}_i \times \left( \frac{\text{Taux Remise}_i}{100} \right)$$
$$\text{Total Net HT Ligne}_i = \text{Total Brut Ligne}_i - \text{Remise Ligne}_i$$

Pour la facture complète :
$$\text{Total HT Brut} = \sum \text{Total Net HT Ligne}_i$$
$$\text{Remise Globale} = \text{Total HT Brut} \times \left( \frac{\text{Taux Remise Globale}}{100} \right)$$
$$\text{Total HT Net Commercial} = \text{Total HT Brut} - \text{Remise Globale}$$
$$\text{Montant TVA} = \sum \left( \text{Base Taxable Taux}_k \times \frac{\text{Taux TVA}_k}{100} \right)$$
$$\text{Total TTC} = \text{Total HT Net Commercial} + \text{Montant TVA}$$
$$\text{Retenue à la source (AIB)} = \text{Total HT Net} \times \text{Taux AIB}$$
$$\text{Net à Payer Client} = \text{Total TTC} - \text{Retenue AIB}$$

> ⚠️ **Règle d'arrondi :** Les calculs intermédiaires conservent 4 décimales. Le montant final TTC et le Net à Payer sont arrondis à 0 décimale (en FCFA) ou 2 décimales (devises décimales).

---

## 4. Scénarios Métier Vérifiables (BDD / Gherkin)

### Scénario 1 : Validation d'un paiement partiel puis total
```gherkin
Fonctionnalité : Règlements Facture

Scénario : Enregistrement d'un acompte puis du solde
  Étant donné une facture "FA-2026-0010" d'un montant TTC de 100 000 FCFA au statut "ISSUED"
  Et un cumul des paiements actuels de 0 FCFA

  Quand l'utilisateur enregistre un paiement de 40 000 FCFA
  Alors le statut de la facture devient "PARTIALLY_PAID"
  Et le solde restant dû de la facture est de 60 000 FCFA

  Quand l'utilisateur enregistre un second paiement de 60 000 FCFA
  Alors le statut de la facture devient "PAID"
  Et le solde restant dû de la facture est de 0 FCFA
```

### Scénario 2 : Refus de paiement supérieur au solde
```gherkin
Scénario : Tentative de trop-perçu
  Étant donné une facture "FA-2026-0010" au statut "PARTIALLY_PAID" avec un reste à payer de 60 000 FCFA

  Quand l'utilisateur tente d'enregistrer un paiement de 75 000 FCFA
  Alors le système rejette l'opération avec l'erreur "PAYMENT_EXCEEDS_REMAINING_AMOUNT"
  Et aucun mouvement financier n'est enregistré
  Et le reste à payer demeure 60 000 FCFA
```

---

## 5. Dictionnaire des Erreurs Métier

| Code d'erreur | Situation | Action corrective |
|---|---|---|
| `INVOICE_ALREADY_VALIDATED` | Tentative d'édition d'une facture déjà émise | Créer un avoir pour rectifier |
| `INVOICE_CANNOT_BE_DELETED` | Tentative de suppression d'une facture validée | Opération strictement refusée |
| `QUOTATION_NOT_ACCEPTED` | Tentative de conversion d'un devis non accepté | Faire accepter le devis d'abord |
| `PAYMENT_EXCEEDS_REMAINING_AMOUNT` | Montant de règlement supérieur au solde dû | Corriger le montant du paiement |
| `CREDIT_NOTE_EXCEEDS_INVOICE` | Avoir supérieur au montant restant de la facture | Ajuster le montant de l'avoir |
