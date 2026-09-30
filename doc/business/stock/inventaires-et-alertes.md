# 📋 Inventaires Physiques, Alertes & Péremptions

Ce document décrit les règles métier encadrant les sessions de comptage physique, la détection des écarts de stock, les réapprovisionnements et le suivi des dates de péremption.

---

## 1. Sessions d'Inventaire Physique

### BM-STK-010 — Cycle de Vie d'une Session d'Inventaire
Une session d'inventaire permet de confronter le stock théorique (calculé par le logiciel) au stock réel (compté physiquement dans les rayons).

```text
               ┌──────────┐
               │  DRAFT   │ (Préparation de la liste des articles)
               └────┬─────┘
                    │ Démarrer le comptage
                    ▼
           ┌─────────────────┐
           │   IN_PROGRESS   │ (Saisie des quantités réelles)
           └────────┬────────┘
                    │ Clôturer et valider
                    ▼
           ┌─────────────────┐
           │    VALIDATED    │ ◄────── IMMUABLE (Ajustements générés)
           └─────────────────┘
```

### BM-STK-011 — Régularisation Automatique des Écarts
Lors de la validation de la session par le Responsable Stock :
1. Pour chaque article :
   $$\text{Écart} = \text{Quantité Réelle Comptée} - \text{Quantité Théorique Système}$$
2. **Si Écart > 0 (Surplus) :**
   - Création automatique d'un mouvement `AJUSTEMENT_POSITIF`.
   - Valorisé au CMUP courant.
3. **Si Écart < 0 (Déficit / Perte / Casse / Vol) :**
   - Création automatique d'un mouvement `AJUSTEMENT_NEGATIF`.
   - Sortie valorisée au CMUP courant pour constater la perte comptable.
4. **Une session validée ne peut plus être modifiée.**

---

## 2. Seuils d'Alerte et Réapprovisionnement

### BM-STK-012 — Niveaux de Stock et Déclenchement d'Alerte

```text
Quantité en Stock
   ▲
   │        [ Niveau Optimal ]
   │
───┼─────────────────────────────────  Seuil de Réapprovisionnement (Stock d'Alerte)
   │        [ Zone d'Alerte : Commande Fournisseur recommandée ]
───┼─────────────────────────────────  Stock de Sécurité
   │        [ Zone Critique : Risque imminent de rupture ]
───┼─────────────────────────────────  Rupture (0)
   ▼
```

- **Stock d'Alerte (Seuil Minimum) :** Dès que `Stock Disponible <= Seuil Alerte`, le système affiche un avertissement et génère une proposition de réapprovisionnement.
- **Formule de Commande Suggérée :**
  $$\text{Quantité Suggérée} = \text{Stock Maximum Ciblé} - \text{Stock Disponible} - \text{Commandes Fournisseur en Cours}$$

---

## 3. Gestion des Dates Limites de Consommation (DLC / DLUO)

### BM-STK-013 — Surveillance des Péremptions
- Chaque lot de produit périssable est associé à une date d'expiration (`expiryDate`).
- **Seuil d'Alerte Anticipé (`expiry_alert_days`) :** Configuré par article ou par défaut à 30 jours.
  - Dès que : $\text{Date Expiration} - \text{Date Courante} \le \text{expiry\_alert\_days}$, l'article apparaît dans le tableau de bord des alertes péremption.
- **Péremption Échue :** Dès que $\text{Date Courante} > \text{Date Expiration}$ :
  - L'article est **automatiquement verrouillé pour la vente** (`PRODUCT_EXPIRED`).
  - Il ne peut être extrait du stock que via un mouvement de `REBUT_PEREMPTION`.
