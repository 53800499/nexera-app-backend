# Observabilité, Métriques & Monitoring — Backend Nexera ERP

---

## 1. Piliers d'Observabilité

L'architecture d'observabilité de **Nexera ERP** est articulée autour des trois piliers fondamentaux : **Métriques**, **Logs** et **Traces d'Audit**.

```
                           +---------------------------+
                           |  OBSERVABILITÉ NEXERA     |
                           +---------------------------+
                            /           |           \
                           /            |            \
                          v             v             v
                  [MÉTRIQUES]        [LOGS]     [TRACES D'AUDIT]
                 Prometheus API   Winston JSON    Table audit_logs
                 (/metrics)       (stdout/stderr) (Immuable RLS)
```

---

## 2. Métriques Prometheus (`MetricsModule`)

Le backend intègre nativement un collecteur de métriques exposé sur l'endpoint sécurisé `/metrics` :

### Métriques Clés Exposées :
- `http_requests_total{method, route, status}` : Compteur cumulé des requêtes HTTP reçues.
- `http_request_duration_seconds{method, route, le}` : Histogramme de distribution des temps de réponse (p50, p90, p99).
- `mecef_normalization_total{status}` : Nombre de factures soumises à la DGI avec étiquette `success` ou `failure`.
- `database_query_duration_seconds` : Temps d'exécution des requêtes SQL Prisma.
- `active_tenants_gauge` : Nombre de tenants ayant eu une activité au cours des dernières 24 heures.

---

## 3. Sondes de Santé Applicative (`HealthModule`)

Accessibles sans authentification pour les sondes d'infrastructure :

| Endpoint | Type de Sonde | Critères d'Évaluation | Réponse Attendue |
| :--- | :--- | :--- | :--- |
| `/health` | Bilan Général | Connexion PostgreSQL + Espace disque suffisant. | `{"status":"ok","info":{"database":{"status":"up"}}}` |
| `/health/liveness` | Sonde de Vie | Vérifie que le processus Node.js n'est pas figé (*deadlock*). | `{"status":"up"}` |
| `/health/readiness`| Sonde d'Aptitude | Confirme que Prisma peut exécuter une requête SQL `SELECT 1`. | `{"status":"ready"}` |

---

## 4. Journalisation des Logs & Audit Trail Inviolable

### 4.1 Logs Applicatifs Structurés
Les journaux sont émis sur `stdout` au format JSON standardisé :
```json
{
  "level": "info",
  "timestamp": "2026-09-16T10:20:15.890Z",
  "context": "MecefClientService",
  "message": "Facture FACT-202609-0015 normalisée avec succès par la DGI (BJ01-A1B2-C3D4-E5F6)",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "invoiceId": "d3b07384-d113-466a-a223-95e53303666f",
  "durationMs": 342
}
```

### 4.2 Registre d'Audit Inaltérable (`audit_logs`)
Toute action modifiant des données financières, salariales ou des habilitations déclenche un enregistrement immédiat en base de données protégé par RLS :
- Identité de l'auteur (`userId`, `ipAddress`, `userAgent`).
- Entité affectée (`INVOICE`, `PAYMENT`, `PAYROLL_SLIP`, `USER_ROLE`).
- Type d'action (`CREATE`, `UPDATE`, `DELETE`, `NORMALIZE`).
- Capture des valeurs antérieures et postérieures (*JSON Diff*).
