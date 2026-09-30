# 📡 09 — Synchronisation Hors-Ligne (Offline Sync Backend)

Ce document détaille la logique backend de traitement des opérations hors-ligne (`src/modules/sync`).

---

## 1. Dépilage Transactionnel par Lots (`SyncService`)

Lorsque le frontend rétablit sa connexion Internet, il transmet la file d'attente locale via `POST /api/sync/batch` :

```typescript
export interface SyncBatchDto {
  operations: Array<{
    localId: string;
    entity: 'invoice' | 'quotation' | 'stockMovement';
    action: 'CREATE' | 'UPDATE';
    payload: any;
    clientTimestamp: string;
  }>;
}
```

### Ordre de Traitement Garanti :
1. Les opérations sont **triées par horodatage client croissant** (`clientTimestamp`).
2. L'exécution s'effectue dans une transaction atomique :
   - Si une opération crée une facture, le numéro officiel chronologique du serveur est attribué.
   - Une table de correspondance `{ localId ➔ serverId, officialNumber }` est renvoyée au client pour mise à jour de son stockage local.

---

## 2. Détection & Arbitrage des Conflits

- **Autorité Serveur :** En cas d'incohérence (ex: le stock d'un produit a été épuisé par un autre utilisateur pendant la déconnexion), le serveur ne corrompt pas l'état réel.
- **Réponse de Conflit Structurée :**
  L'opération conflictuelle est isolée et retournée avec le statut `CONFLICT` :
  ```json
  {
    "localId": "LOCAL-INV-001",
    "status": "CONFLICT",
    "code": "SYNC_CONFLICT_INSUFFICIENT_STOCK",
    "details": { "itemId": "item_123", "requested": 5, "available": 1 }
  }
  ```
  Les autres opérations saines du lot sont quant à elles validées avec succès.
