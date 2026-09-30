# 📦 03 — Gestion des Stocks, CMUP & Inventaires

Ce document détaille la logique métier et les calculs du module `stock`.

---

## 1. Recalcul Mathématique du CMUP à Chaque Entrée

Le Coût Moyen Unitaire Pondéré (CMUP) est recalculé de manière transactionnelle à chaque réception fournisseur :

$$\text{Nouveau CMUP} = \frac{(\text{Stock Existant} \times \text{Ancien CMUP}) + (\text{Quantité Achetée} \times \text{Prix Achat HT})}{\text{Stock Existant} + \text{Quantité Achetée}}$$

### Implémentation Transactionnelle (`StockService`) :
```typescript
await this.prisma.$transaction(async (tx) => {
  const article = await tx.catalogItem.findUniqueOrThrow({ where: { id: itemId, tenantId } });
  
  const stockActuel = article.currentStock;
  const ancienCmup = article.cmup;
  const valeurActuelle = stockActuel * ancienCmup;
  const valeurNouvelleEntree = quantity * purchasePriceHt;
  
  const nouveauStock = stockActuel + quantity;
  const nouveauCmup = nouveauStock > 0 ? (valeurActuelle + valeurNouvelleEntree) / nouveauStock : purchasePriceHt;

  // 1. Mise à jour de l'article
  await tx.catalogItem.update({
    where: { id: itemId },
    data: { currentStock: nouveauStock, cmup: nouveauCmup }
  });

  // 2. Historisation de la variation de CMUP
  await tx.stockCmupHistory.create({
    data: {
      tenantId,
      itemId,
      oldCmup: ancienCmup,
      newCmup: nouveauCmup,
      quantityAdded: quantity,
      purchasePrice: purchasePriceHt
    }
  });

  // 3. Création du mouvement de stock traçable
  await tx.stockMovement.create({ ... });
});
```

---

## 2. Règle de Sortie de Stock & Contrôle du Stock Négatif

- **Valorisation des Sorties :** Toute sortie de stock (vente, perte, casse) est valorisée au **CMUP en vigueur**. Elle ne modifie jamais la valeur unitaire du CMUP.
- **Interdiction du Stock Négatif :**
  Si `quantiteSortie > stockDisponible` et que le Tenant n'a pas activé l'option de survente :
  ```typescript
  if (stockActuel < quantity && !tenantSettings.allowNegativeStock) {
    throw new BadRequestException('INSUFFICIENT_STOCK: Stock disponible insuffisant.');
  }
  ```

---

## 3. Sessions d'Inventaire Physique

Lors de la clôture d'une session d'inventaire (`POST /api/stock/inventory/:id/validate`) :
1. Calcul de l'écart par article : $\text{Écart} = \text{Quantité Réelle Comptée} - \text{Quantité Théorique}$.
2. Si $\text{Écart} \ne 0$ :
   - Génération d'un mouvement d'ajustement (`AJUSTEMENT_INVENTAIRE`).
   - Valorisation de la perte ou du surplus au CMUP courant.
   - Ajustement du compteur de stock physique.
3. La session est verrouillée au statut `VALIDATED` (immuable).
