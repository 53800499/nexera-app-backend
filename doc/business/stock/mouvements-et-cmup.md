# 📦 Gestion des Stocks — Mouvements & Valorisation CMUP

Ce document formalise la gestion logistique et la valorisation comptable des stocks dans Nexera.

---

## 1. Les Règles Métier Clés

### BM-STK-001 — Formule Officielle de Recalcul du CMUP
Nexera utilise la méthode d'inventaire permanent du **Coût Moyen Unitaire Pondéré (CMUP) calculé après chaque entrée** (méthode de référence OHADA / IFRS).

#### Formule lors d'une Entrée en Stock (Achat / Réception) :
$$\text{Nouveau CMUP} = \frac{(\text{Quantité Existante} \times \text{Ancien CMUP}) + (\text{Quantité Achetée} \times \text{Prix Achat Unitaire HT})}{\text{Quantité Existante} + \text{Quantité Achetée}}$$

#### Règle lors d'une Sortie de Stock (Vente / Consommation) :
- Les sorties sont valorisées au **CMUP en vigueur au moment de la sortie**.
- **Une sortie ne modifie jamais la valeur unitaire du CMUP**, elle ne diminue que la quantité en stock et la valeur totale du stock.

### BM-STK-002 — Politique de Stock Négatif
- Par défaut, une sortie de stock qui amènerait la quantité disponible en dessous de 0 est **STRICTEMENT BLOQUÉE** avec l'erreur `INSUFFICIENT_STOCK`.
- Une exception configurable par Tenant peut autoriser le stock négatif temporaire pour des flux ultra-rapides, mais déclenche une notification d'anomalie critique.

### BM-STK-003 — Typologie et Justification Obligatoire des Mouvements
Chaque mouvement de stock doit obligatoirement posséder :
- Un type parmi : `RECEPTION_ACHAT`, `LIVRAISON_VENTE`, `TRANSFERT_ENTREPOT`, `AJUSTEMENT_INVENTAIRE`, `REBUT_CASSE`, `RETOUR_CLIENT`, `RETOUR_FOURNISSEUR`.
- Une pièce justificative rattachée (Bon de commande, Bon de livraison, Session d'inventaire, Facture).
- L'identifiant de l'auteur et la date horodatée.

### BM-STK-004 — Transferts Multi-Entrepôts
- Un transfert entre deux entrepôts (ex: Dépôt Principal ➔ Boutique A) génère deux écritures synchrones liées :
  1. Une sortie de l'entrepôt d'origine valorisée au CMUP d'origine.
  2. Une entrée dans l'entrepôt de destination avec recalcul du CMUP local de l'entrepôt de destination.

---

## 2. Exemple Chiffré Pas-à-Pas (Traçabilité CMUP)

```text
Étape 1 : Stock initial
Quantité = 100 unités
CMUP = 1 000 FCFA
Valeur totale stock = 100 000 FCFA

Étape 2 : Réception commande fournisseur (Entrée)
Quantité reçue = 50 unités
Prix d'achat HT = 1 300 FCFA
Coût de l'achat = 65 000 FCFA

Calcul du nouveau CMUP :
(100 000 + 65 000) / (100 + 50) = 165 000 / 150 = 1 100 FCFA

Nouveau stock : 150 unités à un CMUP de 1 100 FCFA (Valeur = 165 000 FCFA)

Étape 3 : Livraison client (Sortie)
Quantité vendue = 30 unités
Valorisation de la sortie = 30 x 1 100 = 33 000 FCFA (Coût des marchandises vendues)

Nouveau stock : 120 unités à un CMUP inchangé de 1 100 FCFA (Valeur = 132 000 FCFA)
```

---

## 3. Scénarios Métier Vérifiables (BDD / Gherkin)

```gherkin
Fonctionnalité : Sortie de Stock et Valorisation

Scénario : Refus de sortie si stock insuffisant
  Étant donné un article "Câble RJ45" avec un stock disponible de 12 unités dans le "Dépôt Central"
  Quand un utilisateur tente d'effectuer une sortie de 15 unités
  Alors le système bloque l'opération avec l'erreur "INSUFFICIENT_STOCK"
  Et le stock disponible reste à 12 unités
  Et aucun mouvement de stock n'est créé

Scénario : Recalcul automatique du CMUP après réception
  Étant donné un article "Disque SSD 1To" avec 10 unités à 50 000 FCFA (Total = 500 000 FCFA)
  Quand l'utilisateur enregistre une réception de 10 unités achetées à 60 000 FCFA
  Alors la quantité totale devient 20 unités
  Et le nouveau CMUP calculé est exactement de 55 000 FCFA
  Et l'historique CMUP conserve la trace de la variation
```

---

## 4. Dictionnaire des Erreurs Stock

| Code d'erreur | Description |
|---|---|
| `INSUFFICIENT_STOCK` | Stock actuel inférieur à la quantité demandée en sortie |
| `NEGATIVE_STOCK_DISALLOWED` | La politique de l'entreprise interdit le stock inférieur à 0 |
| `WAREHOUSE_NOT_FOUND` | L'entrepôt spécifié n'existe pas ou n'appartient pas au Tenant |
| `INVALID_QUANTITY` | La quantité d'un mouvement doit être strictement supérieure à 0 |
