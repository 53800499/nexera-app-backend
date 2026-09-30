# ADR-001 : Immuabilité Absolue des Factures Validées et Rectification par Avoir

- **Date :** 2026-09-23
- **Statut :** ACCEPTÉ
- **Auteurs :** Équipe Nexera Core
- **Module(s) concerné(s) :** Commercial, Facturation, Fiscalité, Audit

---

## 1. Contexte et Problématique

Dans les logiciels de gestion d'entreprise, une erreur fréquente consiste à permettre aux utilisateurs de modifier ou supprimer des factures de vente après leur émission.

Cependant :
- La législation fiscale (notamment le Code Général des Impôts, les normes OHADA, les arrêtés FEC et le système MECEF de facturation normalisée) **interdit formellement toute modification rétroactive ou suppression** d'une facture émise.
- En cas de contrôle fiscal, toute rupture de séquence de numérotation ou modification de montant après certification expose l'entreprise et l'éditeur à de lourdes sanctions.

---

## 2. Options Envisagées

### Option A : Autoriser la modification tant que la facture n'est pas payée
- **Avantages :** Confort apparent pour l'utilisateur qui peut corriger une simple faute d'orthographe ou un prix erroné.
- **Inconvénients :** Non conforme aux normes légales ; falsification possible de la comptabilité ; rejet du Fichier des Écritures Comptables (FEC) lors des contrôles.

### Option B : Verrouillage strict dès l'état `ISSUED` et obligation d'Avoir (Credit Note)
- **Avantages :** 100 % conforme aux obligations légales ; traçabilité comptable parfaite ; compatibilité totale avec la certification MECEF.
- **Inconvénients :** Nécessite que l'utilisateur comprenne le mécanisme d'émission d'un avoir pour corriger ou annuler une facture.

---

## 3. Décision Prise

> **Décision :** Nous retenons l'**Option B**. Dès qu'une facture quitte le statut `DRAFT` et passe au statut `ISSUED` (ou `NORMALIZED`), elle devient **strictement immuable**. Aucun `UPDATE` de lignes ni `DELETE` n'est autorisé. Toute annulation ou régularisation s'effectue exclusivement par la création d'un **Avoir (Note de crédit)**.

---

## 4. Conséquences

### Positives
- Conformité fiscale garantie devant la DGI et conformité avec l'arrêté portant présentation du FEC.
- Piste d'audit fiable et inattaquable.
- Prévention de la fraude interne dans les entreprises clientes.

### Contraintes acceptées
- Les interfaces utilisateurs doivent guider clairement l'utilisateur : bouton « Émettre un avoir partiel/total » au lieu d'un bouton « Modifier/Supprimer ».
- Le contrôleur Back-end (`InvoicesController`) et le service (`InvoicesService`) bloquent formellement les routes d'édition si `status !== 'DRAFT'`.

---

## 5. Règle Métier et Fichiers Associés
- **Règles métier :** `BM-COM-002`, `BM-COM-003`, `BM-MEC-003`
- **Fichiers :**
  - `back-end/src/modules/invoices/invoices.service.ts`
  - `back-end/src/modules/invoices/credit-notes.service.ts`
