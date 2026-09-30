# 💼 02 — Cycle Commercial, Facturation & Normalisation Fiscale

Ce document décrit la logique métier backend des modules `quotations`, `orders`, `invoices` et `catalogue`.

---

## 1. Numérotation Séquentielle sans Rupture

La réglementation fiscale et comptable impose que les factures et avoirs disposent d'une numérotation continue, chronologique et sans trou :

```text
Format Standard : FA-{ANNEE}-{NUMERO_INCREMENTAL} (ex: FA-2026-0001, FA-2026-0002)
Format Avoir    : AV-{ANNEE}-{NUMERO_INCREMENTAL} (ex: AV-2026-0001)
```

### Algorithme d'Incrémentation Sécurisé :
Pour éviter tout doublon en cas de requêtes concurrentes, l'attribution du numéro s'effectue dans une transaction Prisma avec verrouillage de séquence :
1. Recherche du dernier numéro attribué pour l'année et le Tenant en cours.
2. Incrémentation de $+1$.
3. Attribution définitive lors du passage du statut `DRAFT` à `ISSUED`.

---

## 2. Règle d'Immuabilité Fiscale & Verrous Applicatifs

Dès qu'une facture atteint le statut `ISSUED` ou `NORMALIZED` :
- Les méthodes `update()` et `delete()` du service `InvoicesService` bloquent immédiatement l'opération :
  ```typescript
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new ForbiddenException('Une facture émise ne peut être ni modifiée ni supprimée. Émettez un avoir.');
  }
  ```
- **Seul un Avoir (Credit Note)** rattaché à la facture d'origine permet d'annuler ou de rectifier un montant.

---

## 3. Règle Métier de l'Avoir (`CreditNotesService`)

1. L'avoir référence obligatoirement la facture d'origine via `originalInvoiceId`.
2. Vérification du plafond disponible :
   $$\sum \text{Avoirs Existants} + \text{Nouvel Avoir} \le \text{Total TTC Facture}$$
   Si le montant dépasse, le service lève une `BadRequestException('CREDIT_NOTE_EXCEEDS_INVOICE_TOTAL')`.
3. L'émission de l'avoir recalcule immédiatement le reste à payer sur la facture d'origine.

---

## 4. Certification Fiscale e-MECeF (Facturation Normalisée)

Lors de la validation d'une facture normalisée :
1. Vérification de l'IFU du client (obligatoire pour les entreprises assujetties).
2. Construction du payload normalisé comprenant les groupes de taxe officiels (A = 0%, B = 18%, etc.).
3. Appel sécurisé à la passerelle MECEF.
4. Enregistrement des données de retour infalsifiables :
   - `mecefNim` : Numéro d'Identification de la Machine.
   - `mecefCounters` : Compteur journalier et global.
   - `mecefToken` : Signature numérique DGI.
   - `mecefQrCode` : URL officielle de vérification fiscale.
