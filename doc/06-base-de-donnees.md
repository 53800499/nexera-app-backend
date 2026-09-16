# Documentation de la Base de Données — Backend Nexera ERP

---

## 1. Vue d'Ensemble du Modèle de Données

La base de données de **Nexera ERP** repose sur **PostgreSQL 15+**, orchestrée via **Prisma ORM v7**. Elle adopte une conception relationnelle normalisée en Troisième Forme Normale (3NF), optimisée pour la consistance financière et l'intégrité référentielle stricte.

### Caractéristiques Majeures :
- **Clés Primaires** : Identifiants Universels Uniques (UUID v4) sur toutes les tables d'entités (`id String @id @default(uuid())`).
- **Cloisonnement Multi-Tenant** : Présence systématique d'une clé étrangère `tenantId` indexée sur toutes les tables contenant des données d'entreprise.
- **Sécurité RLS Native** : Politiques de sécurité au niveau de la ligne (*Row Level Security*) appliquées sur le moteur PostgreSQL.
- **Traçabilité Temporelle** : Champs normalisés `createdAt DateTime @default(now())` et `updatedAt DateTime @updatedAt` sur toutes les tables.

---

## 2. Organisation Modulaire des Tables

```
+------------------------------------------------------------------------------------------+
|                                    TABLES DE DONNÉES NEXERA                              |
+------------------------------------------------------------------------------------------+
| GESTION DU SOCLE & TENANTS :                                                             |
|  • tenants                    • tenant_settings          • tenant_currencies             |
|  • users                      • sessions                 • refresh_tokens                |
|  • roles                      • permissions              • role_permissions              |
|  • audit_logs                                                                            |
+------------------------------------------------------------------------------------------+
| GESTION COMMERCIALE & VENTES :                                                           |
|  • clients                    • contacts                 • client_addresses              |
|  • catalog_items              • catalog_categories       • tax_rates                     |
|  • quotations                 • quotation_lines          • payment_terms                 |
|  • orders                     • order_lines                                              |
|  • invoices                   • invoice_lines            • advance_applications          |
|  • recurring_invoices         • payments                 • payment_imputations           |
|  • reminders                  • stock_movements          • warehouses                    |
+------------------------------------------------------------------------------------------+
| RESSOURCES HUMAINES & PAIE (schema-rh.prisma) :                                          |
|  • employees                  • contracts                • leave_requests                |
|  • payroll_periods            • payroll_slips            • payroll_rubrics               |
|  • social_declarations        • tax_brackets_ipts                                        |
+------------------------------------------------------------------------------------------+
| FRAIS, CABINET & FISCALITÉ :                                                             |
|  • expense_reports            • expense_lines            • mission_advances              |
|  • cabinet_entities           • cabinet_collaborateurs   • client_mandats                |
|  • tax_contribuables          • tva_declarations         • fec_exports                   |
+------------------------------------------------------------------------------------------+
```

---

## 3. Détail des Entités Financières & e-MECeF

### Modèle `Invoice` (Factures)
Extrait des champs majeurs liés à la fiscalité et à la certification DGI :

| Colonne | Type | Description / Règle Métier |
| :--- | :--- | :--- |
| `id` | `UUID` (PK) | Identifiant unique interne. |
| `tenant_id` | `UUID` (FK) | Référence au tenant propriétaire. |
| `number` | `String` (Unique) | Numéro officiel séquentiel (ex. `FACT-202609-0042`). |
| `invoice_type` | `InvoiceType` | `standard`, `deposit`, `credit_note`, `proforma`. |
| `status` | `InvoiceStatus` | `draft`, `issued`, `paid`, `partially_paid`, `cancelled`. |
| `base_ht` | `Float` | Montant total net hors taxe en devise de facturation. |
| `total_tax` | `Float` | Montant total de la TVA calculée. |
| `total_ttc` | `Float` | Montant total Toutes Taxes Comprises. |
| `normalization_status`| `MecefStatus` | `not_normalized`, `pending`, `normalized`, `failed`. |
| `mecef_nim` | `String?` | Numéro d'Identification de la Machine attribué par la DGI. |
| `mecef_counters` | `String?` | Compteurs séquentiels officiels (ex. `15/450 FV`). |
| `mecef_code` | `String?` | Signature de sécurité cryptographique DGI (`BJ01-...`). |
| `mecef_qr_code_data` | `String?` | Données textuelles encodées dans le QR Code DGI officiel. |
| `mecef_tax_group_totals`| `Json?` | Ventilation des bases et taxes par groupes A, B, C, D, E. |
| `mecef_aib_type` | `MecefAibType` | `NONE`, `A` (1%), `B` (5%). |
| `mecef_aib_amount` | `Float` | Montant de l'acompte fiscal AIB calculé. |
| `original_mecef_code` | `String?` | Référence au code MECeF d'origine (obligatoire pour avoirs). |

---

## 4. Politiques Row-Level Security (PostgreSQL RLS)

Chaque table sensible dispose de la directive PostgreSQL activant RLS et de sa règle d'évaluation :

```sql
-- 1. Activation de RLS sur la table des factures
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 2. Création de la politique d'isolation étanche
CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::text
  );
```

### Rôle Applicatif vs Rôle Superviseur
- L'utilisateur applicatif de production se connecte avec un rôle sans privilège superutilisateur (`app_user`). Il ne peut en aucun cas contourner la politique RLS.
- Lors de l'exécution des migrations Prisma (`prisma migrate deploy`), la connexion s'effectue via un rôle administrateur de base de données disposant du privilège `BYPASSRLS`.

---

## 5. Stratégie d'Indexation & Performance

Pour garantir des temps de réponse sous les 150 ms sur des volumes de millions de lignes, les index composites suivants sont déployés :

```sql
-- Index d'accès rapide aux factures d'un tenant par date et statut
CREATE INDEX idx_invoices_tenant_date_status 
ON invoices(tenant_id, issue_date DESC, status);

-- Index d'unicité du numéro de facture au sein du tenant
CREATE UNIQUE INDEX idx_invoices_tenant_number 
ON invoices(tenant_id, number);

-- Index pour la recherche par client et historique des règlements
CREATE INDEX idx_invoices_tenant_client 
ON invoices(tenant_id, client_id);

-- Index pour les recherches de contrôle e-MECeF
CREATE INDEX idx_invoices_mecef_code 
ON invoices(mecef_code) WHERE mecef_code IS NOT NULL;
```

---

## 6. Gestion des Migrations & Données Initiales (Seeds)

### 6.1 Cycle des Migrations
Les modifications de schéma sont gérées via Prisma Migrate :
```bash
# Génération d'une nouvelle migration en développement
npx prisma migrate dev --name <nom_descriptif>

# Application des migrations en production (sans invite interactive)
npx prisma migrate deploy
```

### 6.2 Données de Référence (Seeds)
Le projet fournit des jeux de données d'initialisation sectoriels via `package.json` :
- `npm run db:seed` : Initialise le tenant de démonstration, les rôles RBAC standards, les devises officielles et les taux de taxe.
- `seed-rh.ts` : Injecte la convention collective interprofessionnelle, les rubriques de paie types et les barèmes de cotisations CNSS / IPTS Bénin.
- `seed-fiscalite.ts` : Initialise le référentiel des taxes, les comptes comptables SYSCOHADA et les modèles déclaratifs.
- `seed-ndf.ts` : Injecte les catégories de dépenses professionnelles types et les plafonds kilométriques.
