# ⚙️ Logique Métier & Règles Fonctionnelles — Backend Nexera ERP

Bienvenue dans le guide de référence de la **logique métier backend de Nexera (`back-end`)**.

Ce dossier fournit à tout développeur backend (NestJS / Prisma / PostgreSQL) la description détaillée de **comment le serveur applique les règles de gestion, garantit l'intégrité comptable et fiscale, isole les tenants et traite chaque flux métier.**

---

## 🏛️ Les 5 Piliers Fondamentaux de l'Architecture Backend

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   LES 5 PILIERS DU BACKEND NEXERA                      │
├───────────────────┬────────────────────────────────────────────────────┤
│ 1. Isolation      │ Chaque requête SQL Prisma filtre impérativement    │
│    Multi-Tenant   │ sur `tenantId` issu du token JWT authentifié.       │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. Immuabilité    │ Aucune facture, aucun avoir ni bulletin clôturé ne │
│    Légale         │ peut faire l'objet d'un UPDATE ou d'un DELETE.     │
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. Transactions   │ Tout mouvement de stock ou règlement s'exécute dans│
│    Atomiques      │ `this.prisma.$transaction(...)` pour zéro désaccord│
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. Audit Trail    │ Toute mutation sensible crée un log dans la table  │
│    Infalsifiable  │ `audit_logs` en mode Append-Only avec old/new JSON │
├───────────────────┼────────────────────────────────────────────────────┤
│ 5. Autorité       │ Le serveur recalcule systématiquement tous les     │
│    du Serveur     │ montants sans faire confiance aux données client.  │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 🗺️ Cartographie des Guides Métier Backend

| Guide | Modules Backend Couverts | Thématiques Clés Traitées |
| :--- | :--- | :--- |
| 🔐 [**01 - Authentification, Multi-Tenant & Utilisateurs**](./01-auth-et-tenants.md) | `auth`, `tenants`, `users`, `roles`, `permissions` | Extraction JWT, TenantContext, hash bcrypt, rôles tenant-scoped, réinitialisation de mot de passe. |
| 💼 [**02 - Cycle Commercial, Factures & MECEF**](./02-commercial-et-facturation.md) | `quotations`, `orders`, `invoices`, `catalogue` | Devis ➔ Bon de commande ➔ Facture, numérotation séquentielle sans trou, immuabilité, certification MECEF. |
| 📦 [**03 - Stocks, CMUP & Inventaires**](./03-stock-et-cmup.md) | `stock` | Transactions atomiques, recalcul mathématique du CMUP à chaque entrée, mouvements, sessions d'inventaire, DLC/DLUO. |
| 🌴 [**04 - RH & Moteur de Calcul de Paie**](./04-rh-et-moteur-paie.md) | `rh` | Contrats, acquisition des congés (2j/mois), cotisations sociales (CNSS), barèmes IRPP/ITS, net à payer, bulletins. |
| ⚖️ [**04b - Barèmes Fiscaux & Cotisations Sociales**](./04b-baremes-fiscaux-et-cotisations.md) | `rh` (référentiel) | Barèmes ITS (CGI 2026 Art. 125), validation continuité, duplication, CNSS (3.6% / 17.4%), VPS (4%), ORTB, avantages en nature, simulateur. |
| 📊 [**05 - Fiscalité, Déclarations TVA & Export FEC**](./05-fiscalite-et-tva.md) | `fiscalite`, `exports` | TVA collectée/déductible, régime des débits vs encaissements, solde mensuel/crédit, génération du fichier FEC. |
| 🧾 [**06 - Notes de Frais & Politiques de Dépense**](./06-notes-de-frais.md) | `notes-frais` | Justificatifs obligatoires, contrôles de plafonds, barème kilométrique, workflow de validation hiérarchique. |
| 💳 [**07 - Encaissements, Règlements & Relances**](./07-encaissements-et-relances.md) | `payments`, `reminders`, `clients` | Ventilation des paiements sur factures, crédit client, balance âgée (< 30j, 30-60j, 60-90j, > 90j), relances. |
| 🏢 [**08 - Espace Cabinet & Délégation Multi-Dossiers**](./08-espace-cabinet.md) | `cabinet` | Code d'invitation, permissions déléguées, isolation stricte entre dossiers clients, traçabilité des interventions. |
| 📡 [**09 - Synchronisation Hors-Ligne (Offline Sync)**](./09-offline-sync-backend.md) | `sync` | Dépilage par lots, attribution des numéros officiels chronologiques, arbitrage et résolution des conflits. |
| 🛡️ [**10 - Piste d'Audit & Journalisation de Sécurité**](./10-audit-et-securite.md) | `audit` | Table `audit_logs`, structure du payload d'audit, captures avant/après (snapshots), non-répudiation. |

---

## 🏛️ Structure d'un Module NestJS (`src/modules/<nom>/`)

Chaque module backend respecte l'organisation suivante :
```text
src/modules/<nom>/
├── <nom>.controller.ts    # Contrôleur HTTP (Routes, Guards, Swagger)
├── <nom>.service.ts       # Logique métier pure, transactions Prisma, calculs
├── <nom>.module.ts        # Déclaration NestJS (imports, providers, exports)
├── dto/                   # Data Transfer Objects avec validation class-validator
├── entities/ ou types/    # Typages TypeScript
└── listeners/ ou guards/  # Intercepteurs et événements éventuels
```
