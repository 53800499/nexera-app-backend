# Documentation Technique & Fonctionnelle — Backend Nexera ERP

Bienvenue dans la documentation officielle de référence du backend de **Nexera ERP**.

Nexera est une plateforme de gestion d'entreprise intégrée (ERP / FinTech) de nouvelle génération, conçue pour les entreprises et cabinets d'expertise comptable de l'espace **UEMOA / OHADA** (avec une conformité de premier ordre aux normes fiscales de la République du Bénin : **e-MECeF DGI** et **Arrêté 1085-C FEC**).

---

## 🗺️ Cartographie de la Documentation

La documentation est structurée selon les standards de l'ingénierie logicielle pour répondre aux besoins des développeurs, architectes, fiscalistes, auditeurs et exploitants :

### 📚 Documents Directeurs (01 à 12)

| N° | Document | Description & Périmètre | Public Cible |
| :--- | :--- | :--- | :--- |
| **01** | [01 - Document de Cadrage](./01-document-cadrage.md) | Vision produit, contexte réglementaire OHADA/Bénin, personas, périmètre et limites. | Tous, Chefs de projet |
| **02** | [02 - Cahier des Charges](./02-cahier-des-charges.md) | Exigences fonctionnelles et non-fonctionnelles, contraintes légales et d'intégrité. | PO, Auditeurs, Lead Dev |
| **03** | [03 - Spécifications Fonctionnelles](./03-specifications-fonctionnelles.md) | Description détaillée des 23 modules métiers (CRM, Ventes, e-MECeF, Paie, NDF, etc.). | PO, Développeurs |
| **04** | [04 - Architecture Technique](./04-architecture-technique.md) | Architecture logicielle NestJS, pattern modulaire, multi-tenancy RLS, bus d'événements. | Architectes, Développeurs |
| **05** | [05 - Spécifications Techniques](./05-specifications-techniques.md) | Conception détaillée (STD) : transactions Prisma, génération PDF/QR Code, guards, pipes. | Développeurs backend |
| **06** | [06 - Base de Données](./06-base-de-donnees.md) | Modèle relationnel PostgreSQL, schémas Prisma, politiques Row Level Security, index. | DBA, Développeurs |
| **07** | [07 - Référentiel API REST](./07-api.md) | Catalogue complet des endpoints RESTful, DTOs, codes HTTP, Swagger et sécurité JWT. | Développeurs Fullstack |
| **08** | [08 - Documentation du Code](./08-documentation-code.md) | Guide du développeur, conventions de nommage, structuration des modules et workflows. | Développeurs |
| **09** | [09 - Stratégie de Tests](./09-tests.md) | Tests unitaires Jest, tests d'intégration, E2E Supertest, smoke tests commerciaux et sync. | QA, Développeurs |
| **10** | [10 - Guide de Déploiement](./10-deploiement.md) | Conteneurisation Docker, Cloud Render, variables d'environnement, migrations, monitoring. | DevOps, SysAdmin |
| **11** | [11 - Stratégie & Roadmap](./11-doc-strategie-.md) | Haute disponibilité, synchronisation hors-ligne, extensions multi-pays, IA/OCR. | Direction, Lead Tech |
| **12** | [12 - Workflows & Processus Métiers](./12-doc-fonctionnelles.md) | Guides pas-à-pas des cycles clés (devis-facture-eMECeF, paie mensuelle, liasse fiscale). | Intégrateurs, Formateurs |

---

### 📂 Dossiers Spécialisés & Décisions d'Architecture

- 🏛️ **Spécifications Métier Globales (Domain Rules)** : [`business/overview.md`](./business/overview.md) (Règles BM-xxx, acteurs, cycles de vente, CMUP, paie, TVA, MECEF, scénarios BDD Gherkin).
- ⚖️ **Module 7 — Fiscalité & Interconnexions** : [`business/fiscalite/NEXERA_M7_Fiscalite_Architecture_Interconnexions_Metier.md`](./business/fiscalite/NEXERA_M7_Fiscalite_Architecture_Interconnexions_Metier.md) (Architecture du moteur fiscal, contrats inter-modules M1-M7, schéma PostgreSQL `tax`, barèmes versionnés et liquidation IS).
- 🧠 **Logique Métier & Règles Serveur** : [`logique-metier/README.md`](./logique-metier/README.md) (Règles fonctionnelles approfondies pour chaque module : Facturation, CMUP, Paie, TVA, FEC, Audit).
- 🏗️ **Architecture approfondie** : [`architecture/architecture.md`](./architecture/architecture.md) (Diagrammes de flux, séquence et modèles de composants C4).
- 🗄️ **Dictionnaire de Données** : [`database/data-model.md`](./database/data-model.md) (Détail de chaque entité, attributs et contraintes).
- 🚀 **Procédures d'Exploitation** : [`deployment/deployment.md`](./deployment/deployment.md) (Déploiement pas-à-pas, rollback et haute disponibilité).
- 📊 **Observabilité & Métriques** : [`operations/monitoring.md`](./operations/monitoring.md) (Métriques Prometheus, health checks et journalisation d'audit).
- 🛡️ **Sécurité & Conformité** : [`security/security-audit.md`](./security/security-audit.md) (Isolation RLS, RBAC, chiffrement et conformité APDP).
- 🧪 **Plan d'Assurance Qualité** : [`testing/test-strategy.md`](./testing/test-strategy.md) (Matrice de test, couverture et scénarios de non-régression).
- 📜 **Architecture Decision Records (ADR)** :
  - [`adr/ADR-001-architecture-nestjs-prisma.md`](./adr/ADR-001-architecture-nestjs-prisma.md) : Choix du framework NestJS et de Prisma ORM.
  - [`adr/ADR-002-multi-tenancy-postgresql-rls.md`](./adr/ADR-002-multi-tenancy-postgresql-rls.md) : Isolation multi-locataires par Row Level Security (RLS).
  - [`adr/ADR-003-integration-emecef-dgi-benin.md`](./adr/ADR-003-integration-emecef-dgi-benin.md) : Intégration hybride (API & Simulation) e-MECeF Bénin.
  - [`adr/ADR-004-moteur-paie-ohada.md`](./adr/ADR-004-moteur-paie-ohada.md) : Conception du moteur de calcul salarial conforme OHADA / Code du travail.
  - [`adr/ADR-005-conformite-fec-arrete-1085-c.md`](./adr/ADR-005-conformite-fec-arrete-1085-c.md) : Génération et scellement du Fichier des Écritures Comptables.

---

## ⚡ Stack Technologique Clé

- **Framework d'application** : [NestJS v11](https://nestjs.com) (TypeScript, Node.js v20+)
- **Accès aux données** : [Prisma ORM v7](https://www.prisma.io) avec adaptateur PostgreSQL
- **Base de données** : PostgreSQL 15+ avec Row Level Security (RLS) native
- **Authentification & Sécurité** : JWT (Access Token 15 min + Refresh Token sécurisé 7 jours), Bcrypt, RBAC dynamique
- **Génération documentaire** : PDFKit (moteur vectoriel de factures, bulletins et états fiscaux), QRCode
- **Tâches planifiées & Événements** : `@nestjs/schedule` (Cron jobs), bus d'événements mémoire réactif
- **Conteneurisation & Déploiement** : Docker multi-stage build, docker-compose, Cloud Render
- **Documentation API** : OpenAPI 3.0 / Swagger accessible en local sur `/api/docs`

---

## 🧭 Démarrage Rapide

```bash
# 1. Installation des dépendances
npm install

# 2. Génération du client Prisma et configuration de l'environnement
npx prisma generate
cp .env.example .env

# 3. Application des migrations et injection des données de référence
npx prisma migrate deploy
npm run db:seed

# 4. Lancement du serveur en mode développement
npm run start:dev
```

Le serveur démarre par défaut sur le port `3008` (ou `3000` selon `.env`), accessible avec le préfixe `/api`. La documentation interactive Swagger est accessible sur `http://localhost:3008/api/docs`.
