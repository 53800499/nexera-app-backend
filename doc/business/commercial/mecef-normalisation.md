# 🏛️ Facturation Normalisée & MECEF (e-Invoicing)

Ce document décrit les règles métier relatives à la **facture normalisée électronique** (notamment la réglementation DGI / MECEF en vigueur au Bénin et dans l'espace UEMOA).

---

## 1. Contexte Légal et Objectifs

La facture normalisée a pour objet de certifier fiscalement chaque transaction commerciale afin d'éviter la fraude à la TVA et à l'impôt sur les sociétés.

Une facture n'est juridiquement reconnue comme **facture normalisée** que si elle a été soumise au service de certification et qu'elle porte :
1. Les groupes de taxation de TVA officiels.
2. Les mentions du vendeur et de l'acheteur (IFU, RCCM, Adresse).
3. Le numéro d'enregistrement fiscal (Code MECEF / NIM).
4. La signature cryptographique (Hash / Token DGI).
5. Le code QR contenant l'URL officielle de vérification DGI.

---

## 2. Règles Métier de Normalisation

### BM-MEC-001 — Classification des Groupes de Taxation
Chaque article ou prestation facturé doit être rattaché à l'un des groupes fiscaux normalisés :

| Groupe | Désignation | Taux TVA applicable |
|---|---|---|
| **Groupe A** | Produits et services exonérés de TVA | 0 % |
| **Groupe B** | Régime général des biens et services | 18 % |
| **Groupe C** | Exportations de biens et services | 0 % |
| **Groupe D** | Produits d'assurance et régimes spéciaux | Taux spécifique |
| **Groupe E** | Régime des petites entreprises (TPS) | Non assujetti |

### BM-MEC-002 — Retenue à la Source AIB (Acompte sur Impôt Assis sur les Bénéfices)
- Si l'acheteur est une personne morale habilitée ou un organisme public, il a l'obligation de retenir l'AIB à la source.
- Les taux applicables dépendent de la situation fiscale du fournisseur :
  - Fournisseur immatriculé à jour (Attestation Fiscale / IFU valide) : **1 %** (Taux normal).
  - Fournisseur non immatriculé ou sous régime non professionnel : **5 %** (Taux majoré).
- Le montant de l'AIB est déduit du montant TTC pour déterminer le **Net à Payer**.

### BM-MEC-003 — Signature et Non-Répudiation
- Une fois la facture transmise à l'API MECEF et le token de certification reçu :
  - Le document acquiert le statut `NORMALIZED`.
  - Le `mecefToken`, le `nimCode` et le `counters` (compteur total et compteur journalier) sont inscrits définitivement.
  - **Aucune rectification locale n'est possible sans émission d'un Avoir Normalisé correspondant.**

---

## 3. Parcours d'Émission d'une Facture Normalisée

```text
1. Vendeur finalise la facture (DRAFT)
         ↓
2. Clic sur "Valider et Normaliser"
         ↓
3. Validation des prérequis fiscaux (IFU vendeur, IFU client si assujetti, groupes TVA)
         ↓
4. Envoi du payload JSON signé à la passerelle MECEF
         ↓
5. Réception de la réponse DGI :
   ├── Code de confirmation (NIM, Compteurs)
   ├── Signature électronique (Hash DGI)
   └── URL de vérification QR Code
         ↓
6. Intégration dans le PDF officiel de la facture
         ↓
7. Facture passe au statut NORMALIZED
```

---

## 4. Scénario BDD : Refus de normalisation sans IFU client assujetti

```gherkin
Fonctionnalité : Normalisation Fiscale MECEF

Scénario : Client société sans numéro IFU
  Étant donné une facture d'un montant de 500 000 FCFA avec TVA Groupe B (18%)
  Et un client de type "Entreprise" (Personne Morale)
  Mais le client n'a pas de numéro IFU renseigné dans sa fiche

  Quand l'utilisateur demande la normalisation fiscale
  Alors le système bloque la demande avec l'erreur "CLIENT_IFU_REQUIRED_FOR_COMPANIES"
  Et la facture reste à l'état non certifié
  Et un message demande de compléter la fiche client
```
