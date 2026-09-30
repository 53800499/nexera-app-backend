# 📊 Fiscalité d'Entreprise — TVA, Déclarations Périodiques & Crédits

Ce document formalise les règles de calcul de la TVA, l'établissement des déclarations fiscales périodiques et le traitement des crédits fiscaux dans Nexera.

---

## 1. Mécanisme Fondamental de la TVA

La Taxe sur la Valeur Ajoutée (TVA) est un impôt indirect dont l'entreprise est le collecteur pour le compte de l'État :

```text
       TVA Collectée                          TVA Déductible
(Facturée aux clients sur les ventes)   (Payée aux fournisseurs sur les achats)
                 │                                      │
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                      CALCUL DU SOLDE MENSUEL
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │ Si Collectée > Déductible                           │ Si Déductible > Collectée
         ▼                                                     ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│        TVA NETTE À PAYER        │           │          CRÉDIT DE TVA          │
│ (À reverser au Trésor Public)   │           │ (À reporter sur le mois M+1)    │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 2. Les Règles Métier Clés

### BM-FISC-001 — Fait Générateur et Exigibilité
- **Ventes de Biens / Marchandises :** L'exigibilité intervient lors de la **livraison** ou de la **facturation** (régime des débits).
- **Prestations de Services :** L'exigibilité intervient lors de **l'encaissement effectif** du paiement (sauf si l'entreprise a expressément opté pour le régime des débits).

### BM-FISC-002 — Condition Impérative de Déductibilité
Pour qu'une TVA supportée sur un achat fournisseur soit admise en déduction :
1. La dépense doit être engagée pour les besoins stricts de l'exploitation.
2. La facture fournisseur doit être une **facture normalisée conforme** mentionnant expressément le numéro IFU du client (Tenant).
3. La dépense ne doit pas figurer sur la liste des exclusions légales (ex: véhicules de tourisme, frais de représentation somptuaires).

### BM-FISC-003 — Formule de Clôture Périodique de TVA
Pour une période mensuelle donnée :
$$\text{TVA Brute} = \sum \text{TVA Collectée sur Ventes}$$
$$\text{TVA Déductible Totale} = \sum \text{TVA sur Biens \& Services} + \sum \text{TVA sur Immobilisations}$$
$$\text{Solde Théorique} = \text{TVA Brute} - \text{TVA Déductible Totale} - \text{Crédit de TVA du Mois Précédent (M-1)}$$

- **Si $\text{Solde Théorique} > 0$ :**
  - $\text{TVA à Décaisser} = \text{Solde Théorique}$
  - $\text{Nouveau Crédit de TVA} = 0$
- **Si $\text{Solde Théorique} \le 0$ :**
  - $\text{TVA à Décaisser} = 0$
  - $\text{Nouveau Crédit Reportable} = |\text{Solde Théorique}|$

### BM-FISC-004 — Règle du Prorata de Déduction (Régime Mixte)
Pour les entreprises exerçant simultanément des activités taxables et des activités exonérées :
$$\text{Prorata} = \frac{\text{CA Soumis à TVA} + \text{Exportations Taxables}}{\text{CA Total (Taxable + Exonéré)}}$$
$$\text{TVA Réellement Déductible} = \text{TVA Déductible Brute} \times \text{Prorata}$$

### BM-FISC-005 — Figeage Fiscal et Factures Tardives
- Dès qu'une déclaration de TVA est validée et marquée `FILED` (Déposée à l'administration) :
  - **Toutes les factures de ventes et d'achats rattachées à ce mois sont définitivement verrouillées.**
  - **Règle des factures reçues en retard :** Si une facture d'achat datée du mois $M$ est saisie après la clôture fiscale de $M$, elle est automatiquement imputée sur la déclaration du mois $M+1$.

---

## 3. Scénarios BDD : Calcul et Report de Crédit

```gherkin
Fonctionnalité : Déclaration de TVA Mensuelle

Scénario : Report automatique d'un crédit de TVA
  Étant donné une entreprise ayant un crédit de TVA antérieur de 200 000 FCFA issu du mois de mai
  Et qu'en juin :
    - TVA Collectée = 1 000 000 FCFA
    - TVA Déductible sur achats = 700 000 FCFA
  Quand le responsable fiscal calcule la déclaration de juin
  Alors le solde avant report est de 300 000 FCFA (1 000 000 - 700 000)
  Et après imputation du crédit de mai (200 000 FCFA), la TVA nette à payer est de 100 000 FCFA
  Et le nouveau crédit de TVA pour juillet est réinitialisé à 0 FCFA
```

---

## 4. Dictionnaire des Erreurs Fiscales

| Code d'erreur | Description |
|---|---|
| `TAX_PERIOD_ALREADY_CLOSED` | Tentative de modifier une pièce rattachée à une période fiscale clôturée |
| `INVALID_TAX_GROUP` | Groupe fiscal MECEF non reconnu ou non autorisé |
| `NON_DEDUCTIBLE_VAT_WITHOUT_IFU` | La TVA d'une facture sans IFU ne peut pas être déduite fiscalement |
| `DUPLICATE_TAX_DECLARATION` | Une déclaration validée existe déjà pour le mois et l'année sélectionnés |

---

## 5. Documents de Référence Associés

- 📘 [Module 7 : Spécification d'Architecture et Guide Métier — Fiscalité](./NEXERA_M7_Fiscalite_Architecture_Interconnexions_Metier.md) (Architecture multi-pays, schéma `tax`, contrats de données inter-modules M1 à M7, calcul IS & liasse SYSCOHADA).

