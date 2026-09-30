# ⚙️ Backend Nexera ERP (`back-end`)

Bienvenue sur le projet backend de **Nexera**, l'ERP SaaS de gestion commerciale, comptable, fiscale et RH.

Le backend est développé avec **NestJS v11**, **Prisma ORM v7**, **TypeScript** et **PostgreSQL 16**.

---

## 📚 Documentation pour les Développeurs

Pour comprendre le fonctionnement métier du serveur et contribuer efficacement :

1. **🧠 Guides de la Logique Métier Backend :** [**`doc/logique-metier/README.md`**](./doc/logique-metier/README.md)
   - [**01 - Authentification & Multi-Tenant**](./doc/logique-metier/01-auth-et-tenants.md) : Cloisonnement strict `tenantId`, hash bcrypt, JWT et rôles.
   - [**02 - Ventes, Facturation & MECEF**](./doc/logique-metier/02-commercial-et-facturation.md) : Numérotation continue sans trou, immuabilité et DGI e-invoicing.
   - [**03 - Stocks, CMUP & Inventaires**](./doc/logique-metier/03-stock-et-cmup.md) : Recalcul transactionnel du CMUP à chaque entrée et politique de stock négatif.
   - [**04 - RH & Moteur de Paie**](./doc/logique-metier/04-rh-et-moteur-paie.md) : Détection de chevauchement d'absences, calculs de cotisations sociales et bulletins.
   - [**05 - Fiscalité TVA & Export FEC**](./doc/logique-metier/05-fiscalite-et-tva.md) : Calcul du solde de TVA, fait générateur et génération du fichier FEC 18 colonnes.
   - [**06 - Notes de Frais**](./doc/logique-metier/06-notes-de-frais.md) : Workflow d'approbation et plafonds de dépenses.
   - [**07 - Encaissements & Relances**](./doc/logique-metier/07-encaissements-et-relances.md) : Imputation des règlements, balance âgée et scénarios de relances.
   - [**08 - Espace Cabinet**](./doc/logique-metier/08-espace-cabinet.md) : Délégation multi-dossiers, tokens mandat et double audit.
   - [**09 - Synchronisation Offline**](./doc/logique-metier/09-offline-sync-backend.md) : Dépilage des lots, attribution des numéros officiels et arbitrage des conflits.
   - [**10 - Piste d'Audit & Sécurité**](./doc/logique-metier/10-audit-et-securite.md) : Journalisation append-only infalsifiable dans `audit_logs`.

2. **📖 Documentation Technique Complète :** [**`doc/README.md`**](./doc/README.md)
   - Cadrage, cahier des charges, architecture micro-modulaire et déploiement.

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- Node.js 20+ ou 22+
- Docker & Docker Compose (pour PostgreSQL)

### 2. Démarrer PostgreSQL avec Docker
```bash
docker compose up -d postgres
```

### 3. Configuration de l'Environnement
Copiez `.env.example` vers `.env` et ajustez les paramètres de base de données :
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5431/postgres"
```

### 4. Migration & Données Initiales
```bash
# Appliquer les migrations de structure de tables
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Insérer les permissions, rôles et administrateur par défaut
npm run db:seed
```

### 5. Lancement du Serveur de Développement
```bash
npm run start:dev
```
L'API démarre sur : [http://localhost:3008/api](http://localhost:3008/api)
Documentation Swagger : [http://localhost:3008/api/docs](http://localhost:3008/api/docs)

---

## 📁 Architecture des Modules (`src/modules/`)

```text
src/modules/
├── auth/            # Authentification, JWT, refresh tokens
├── tenants/         # Isolation des entreprises & cabinets
├── users/           # Utilisateurs du tenant
├── roles/           # Rôles et gestion des permissions
├── catalogue/       # Articles, produits et prestations
├── quotations/      # Devis commerciaux
├── orders/          # Bons de commande
├── invoices/        # Facturation, avoirs et certification MECEF
├── payments/        # Encaissements et règlements
├── reminders/       # Relances d'impayés et balance âgée
├── stock/           # Mouvements, valorisation CMUP, inventaires
├── rh/              # Employés, contrats, congés, paie, bulletins
├── fiscalite/       # TVA, déclarations périodiques, liasses
├── notes-frais/     # Notes de frais et indemnités kilométriques
├── cabinet/         # Supervision multi-dossiers pour experts-comptables
├── sync/            # Synchronisation des opérations offline
├── exports/         # Export légal du FEC (Fichier des Écritures Comptables)
└── audit/           # Journal d'audit infalsifiable
```

---

## 🏛️ Les 3 Règles d'Or pour Chaque Développeur Backend

1. **Toujours filtrer par `tenantId` :** Aucun `findUnique`, `update` ou `delete` ne doit être exécuté sans inclure `tenantId` dans la clause `where`.
2. **Utiliser des transactions Prisma pour les flux financiers et stocks :**
   Toute opération combinant deux entités (ex: facture + paiement, ou article + mouvement de stock) doit être encapsulée dans `this.prisma.$transaction(async (tx) => { ... })`.
3. **Respecter l'immuabilité :** Ne jamais coder de `DELETE` sur une facture émise, un avoir ou un bulletin de paie clôturé.