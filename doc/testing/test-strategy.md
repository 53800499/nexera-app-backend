# Plan d'Assurance Qualité & Stratégie de Validation — Backend Nexera ERP

---

## 1. Objectifs de Validation & Couverture

Le plan d'assurance qualité de **Nexera ERP** vise à garantir l'absence totale de régression sur les calculs fiscaux, les soldes comptables et les bulletins de paie.

```
+-------------------------------------------------------------------------+
| OBJECTIFS QUALITÉ NEXERA :                                              |
|  • Zéro écart de centime sur les calculs TTC, TVA, AIB et Paie          |
|  • 100% de conformité aux formats officiels DGI (e-MECeF et FEC)        |
|  • 100% d'étanchéité inter-locataires validée par tests automatisés    |
+-------------------------------------------------------------------------+
```

---

## 2. Jeux de Tests Critiques & Cas aux Limites (Edge Cases)

### 2.1 Domaine Facturation & Certification e-MECeF
| Scénario de Test | Données d'Entrée | Comportement Attendu |
| :--- | :--- | :--- |
| **Facture Multi-Taux** | 1 ligne Exonérée (Groupe A) + 1 ligne Taxable 18% (Groupe B). | Ventilation exacte dans `mecefTaxGroupTotals` avec base A et base B distinctes. |
| **Client avec IFU Valide** | Client avec `taxId` à 13 chiffres renseigné, AIB Type `A`. | Calcul automatique de l'AIB à 1% sur le total HT. |
| **Client sans IFU (Particulier)**| Client sans `taxId`, AIB Type `B`. | Calcul automatique de l'AIB à 5% sur le total HT. |
| **Avoir sans Code d'Origine** | Facture `credit_note` sans référence à une facture antérieure. | Avertissement émis, tentative de rattachement automatique via `originalInvoiceId`. |
| **Normalisation sur Proforma** | Facture au statut `proforma`. | Rejet immédiat avec `BadRequestException` (document non comptable). |
| **Normalisation sur Brouillon**| Facture au statut `draft` sans numéro officiel. | Rejet immédiat avec `BadRequestException` (exige statut `issued`). |

### 2.2 Domaine Paie OHADA / Bénin
| Scénario de Test | Données d'Entrée | Comportement Attendu |
| :--- | :--- | :--- |
| **Salarié Célibataire (0 charge)** | Salaire brut = 250 000 XOF, 0 enfant. | Déduction CNSS 3.6% (9 000 XOF), calcul IPTS plein tarif sans abattement charges. |
| **Salarié avec 4 Enfants** | Salaire brut = 500 000 XOF, 4 personnes à charge. | Déduction CNSS 3.6%, application de l'abattement fiscal légal pour famille nombreuse. |
| **Plafond CNSS** | Salaire brut supérieur au plafond légal de cotisation vieillesse. | Écrêtement de la base cotisable au plafond réglementaire CNSS. |
| **VPS Patronal** | Masse salariale brute totale = 5 000 000 XOF. | Calcul exact du Versement Patronal sur Salaires à 4% (200 000 XOF). |

### 2.3 Domaine Fichier des Écritures Comptables (FEC)
| Scénario de Test | Données d'Entrée | Comportement Attendu |
| :--- | :--- | :--- |
| **Équilibre Débit / Crédit** | 10 000 écritures comptables sur l'exercice. | Contrôle $\sum Débit - \sum Crédit = 0.00$. Blocage de l'export si écart > 0.001. |
| **Format Tabulé & Colonnes** | Exportation au format texte normalisé. | Présence exacte des 18 colonnes délimitées par `\t`, encodage strict UTF-8 sans BOM. |
| **Scellement SHA-256** | Fichier exporté généré. | Calcul et signature de l'empreinte cryptographique SHA-256 stockée dans `fec_exports`. |

---

## 3. Matrice d'Exécution des Tests d'Intégration Continue (CI)

```yaml
# Pipeline de Test Automatisé (GitHub Actions / Runner)
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: nexera_test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run test:cov
      - run: npm run smoke:commercial
      - run: npm run smoke:sync
```
