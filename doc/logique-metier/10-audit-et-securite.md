# 🛡️ 10 — Piste d'Audit & Journalisation de Sécurité

Ce document décrit le fonctionnement du module `audit` et les garanties de non-répudiation de Nexera.

---

## 1. Table d'Audit Append-Only (`audit_logs`)

Chaque action sensible (création de facture, ajustement de stock, clôture de paie, changement de rôle, versement de paiement) est journalisée de manière inaltérable :

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique de l'événement |
| `tenant_id` | String | Tenant propriétaire |
| `user_id` | String | Auteur physique de l'action |
| `cabinet_id` | String? | Cabinet mandataire si action déléguée |
| `entity` | String | Entité impactée (`Invoice`, `StockMovement`, `Payslip`...) |
| `entity_id` | String | Identifiant de l'objet concerné |
| `action` | Enum | `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `VALIDATE` |
| `old_values` | JSON? | Snapshot des données avant l'action |
| `new_values` | JSON? | Snapshot des données après l'action |
| `ip_address` | String? | Adresse IP de l'appelant |
| `created_at` | DateTime | Horodatage infalsifiable en UTC |

---

## 2. Règle d'Inaltérabilité en Base de Données

- Aucun endpoint d'API ne permet de modifier (`PUT`/`PATCH`) ou de supprimer (`DELETE`) un enregistrement d'audit.
- En base de données PostgreSQL, les permissions de l'utilisateur applicatif sur `audit_logs` sont limitées à `INSERT` et `SELECT`.
- Les requêtes d'audit permettent d'établir un rapport de contrôle fiscal conforme aux exigences de traçabilité légale.
