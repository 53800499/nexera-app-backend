# 🛡️ Architecture — Multi-Tenancy, Sécurité & Audit Trail

Ce document technique détaille les mécanismes garantissant l'isolation des données, la traçabilité des opérations et la synchronisation sécurisée dans Nexera.

---

## 1. Modèle Multi-Tenant (Isolation Logique Renforcée)

Nexera utilise une architecture multi-tenant à **base de données partagée avec isolation logique par colonne (`tenant_id`)** et contrôle strict au niveau applicatif et base de données (Row-Level Security) :

```text
               REQUÊTE HTTP
                    │
                    ▼
          [ AuthGuard & JwtStrategy ]
          Extrait le payload : { userId, tenantId, roles }
                    │
                    ▼
          [ TenantContextInterceptor ]
          Injecte le tenantId dans le contexte d'exécution (AsyncLocalStorage)
                    │
                    ▼
          [ Service Métier & Prisma Client ]
          Chaque requête WHERE inclut automatiquement :
          `WHERE tenant_id = currentTenantId`
                    │
                    ▼
          [ PostgreSQL avec RLS ]
          Dernier rempart garantissant l'étanchéité absolue en base
```

### Règle d'Or de Développement
- **Aucune requête Prisma ne doit omettre `tenantId` dans sa clause `where`**, sauf les services administratifs transversaux explicitement autorisés (SuperAdmin).
- Les modèles Prisma possèdent l'index composé `@@index([tenantId])` pour garantir des performances optimales sur les tables volumineuses.

---

## 2. Système d'Audit Trail (Journal d'Événements Immuable)

Chaque modification sensible (création de facture, ajustement de stock, validation de congé, changement de statut, versement de paiement) génère automatiquement un enregistrement dans la table `audit_logs` :

| Champ | Description | Exemple |
|---|---|---|
| `id` | UUID unique de l'événement | `uuid-v4` |
| `tenant_id` | Tenant propriétaire de la donnée | `tenant_abc` |
| `user_id` | Utilisateur physique ayant initié l'action | `user_123` |
| `cabinet_id` | Identifiant du cabinet si action déléguée | `cab_789` ou `null` |
| `action` | Type d'action réalisée | `CREATE`, `UPDATE`, `STATUS_CHANGE`, `VALIDATE` |
| `entity` | Modèle concerné | `Invoice`, `StockMovement`, `Payslip`, `Leave` |
| `entity_id` | Identifiant de l'objet impacté | `inv_2026_0045` |
| `old_values` | Snapshot JSON de l'état avant modification | `{"status": "DRAFT", "amount": 100000}` |
| `new_values` | Snapshot JSON de l'état après modification | `{"status": "ISSUED", "amount": 100000}` |
| `ip_address` | Adresse IP de l'appelant | `192.168.1.50` |
| `created_at` | Horodatage infalsifiable | `2026-09-23T17:00:00Z` |

> 🔒 **Propriété de l'Audit Log :** La table `audit_logs` est en mode **Append-Only** (Aucun UPDATE ni DELETE n'est permis au niveau de la base de données).

---

## 3. Architecture de Synchronisation Hors-Ligne (Offline Sync)

Pour les points de vente et les commerciaux en déplacement dans des zones à connectivité instable :
1. **Stockage Local (Front-end) :**
   - Les commandes, devis et sorties de stock sont stockés temporairement dans IndexedDB sur le navigateur.
2. **File d'Attente de Synchronisation (`SyncQueue`) :**
   - Dès rétablissement de la connexion Internet, les opérations en attente sont transmises par lots au back-end (`POST /api/sync`).
3. **Résolution des Conflits :**
   - **Autorité Serveur :** En cas de conflit de stock ou de doublon de numérotation, l'état validé par le serveur prévaut.
   - Les factures générées hors-ligne reçoivent un numéro provisoire, transformé en numéro officiel chronologique lors de l'intégration au serveur.
