# 🌐 Vue d'Ensemble du Domaine Métier — NEXERA

## 1. Vision et Mission du Produit

**Nexera** est un progiciel de gestion intégrée (ERP) en mode SaaS multi-tenant, conçu pour répondre aux besoins opérationnels, financiers, fiscaux et sociaux des PME et des cabinets comptables (notamment en conformité avec les réglementations OHADA, UEMOA et les obligations de facturation normalisée comme la DGI / MECEF).

Le système couvre l'ensemble de la chaîne de valeur d'une entreprise :
1. **Cycle Commercial & Ventes** (Clients, Catalogues, Devis, Commandes, Factures, Règlements, Avoirs).
2. **Gestion des Stocks** (Mouvements d'entrée/sortie, valorisation CMUP, inventaires, transferts, alertes).
3. **Ressources Humaines & Paie** (Gestion des collaborateurs, contrats, congés/absences, calcul des bulletins de salaire).
4. **Notes de Frais** (Notes kilométriques, repas, hébergements, workflow d'approbation et remboursement).
5. **Fiscalité d'Entreprise** (TVA collectée/déductible, déclarations périodiques, liasses, contrôles).
6. **Espace Cabinet Comptable** (Gestion multi-dossiers, supervision financière, export FEC).

---

## 2. Les 5 Principes Invariants du Système

Toute fonctionnalité développée dans Nexera doit obligatoirement respecter ces 5 principes directeurs :

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      LES 5 PRINCIPES INVARIANTS                        │
├───────────────────┬────────────────────────────────────────────────────┤
│ 1. Cloisonnement  │ Aucune donnée d'un Tenant ne doit fuiter vers un   │
│    Strict         │ autre Tenant (isolation absolue en base et API).   │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. Immuabilité    │ Tout document financier validé (facture, avoir,    │
│    Comptable      │ écriture) ne peut plus être ni modifié ni supprimé.│
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. Traçabilité    │ Chaque action critique est consignée dans un       │
│    & Audit        │ journal d'audit infalsifiable avec auteur et date. │
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. Intégrité des  │ Les stocks et les soldes ne peuvent pas diverger ; │
│    Mouvements     │ chaque variation correspond à une pièce justificative.
├───────────────────┼────────────────────────────────────────────────────┤
│ 5. Conformité     │ Respect strict des normes fiscales locales         │
│    Légale         │ (MECEF, TVA, retenues, format de fichier FEC).     │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 3. Cartographie des Flux Métier Globaux

```text
                      ┌──────────────────────┐
                      │    CATALOGUE / PRIX  │
                      └──────────┬───────────┘
                                 │
                                 ▼
┌──────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│    CLIENT    │ ────► │        DEVIS         │ ────► │     BON COMMANDE     │
└──────────────┘       └──────────────────────┘       └──────────┬───────────┘
                                                                 │
                                                                 ▼
┌──────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  STOCK REEL  │ ◄──── │  LIVRAISON / SORTIE  │ ◄──── │  FACTURE NORMALISÉE  │
└──────────────┘       └──────────────────────┘       └──────────┬───────────┘
                                                                 │
                               ┌─────────────────────────────────┼─────────────────────────────────┐
                               │                                 │                                 │
                               ▼                                 ▼                                 ▼
                     ┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
                     │ PAIEMENT / ENCAIS│              │ AVOIR / N. CRÉDIT│              │ DÉCLARATION TVA  │
                     └──────────────────┘              └──────────────────┘              └──────────────────┘
```

---

## 4. Organisation Multi-Tenant

Nexera gère deux types fondamentaux d'organisations :
1. **Entreprise Autonome (`company`)** : Gère ses propres modules commerciaux, stocks, RH et sa comptabilité.
2. **Cabinet Comptable (`cabinet`)** : Peut administrer sa propre entité tout en étant mandaté pour accéder aux dossiers de plusieurs entreprises clientes liées via un système d'invitation sécurisé.
