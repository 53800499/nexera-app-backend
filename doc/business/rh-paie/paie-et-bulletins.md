# 💰 Paie & Bulletins de Salaire — Calculs, Cotisations & Clôture

Ce document décrit la logique métier du moteur de paie de Nexera, depuis les éléments bruts jusqu'au net à payer et au virement bancaire.

---

## 1. Structure Légale d'un Bulletin de Paie

Le calcul d'un bulletin de salaire s'effectue en cascade séquentielle :

```text
1. SALAIRE DE BASE CONTRACTUEL
   + Heures supplémentaires (majorées)
   + Primes fixes & variables
   + Indemnités imposables
   ──────────────────────────────────────────────────────────
   = SALAIRE BRUT TOTAL (Assiette des cotisations sociales)
   
2. - Cotisations Sociales Salariales (ex: CNSS part salariale)
   ──────────────────────────────────────────────────────────
   = SALAIRE BRUT ABATTU
   
3. - Déductions fiscales professionnelles (Frais professionnels)
   ──────────────────────────────────────────────────────────
   = SALAIRE NET IMPOSABLE (Assiette de l'Impôt sur le Revenu)
   
4. - Impôt sur le Revenu Salarié (IRPP / ITS selon barème & charges de famille)
   - Contribution sociale additionnelle (VTS, etc.)
   ──────────────────────────────────────────────────────────
   = SALAIRE NET APRÈS IMPÔT
   
5. + Indemnités non imposables (ex: panier repas, transport justifié)
   - Avances et acomptes déjà perçus dans le mois
   - Prêts employeur ou saisies-arrêts légales
   ──────────────────────────────────────────────────────────
   = NET À PAYER AU SALARIÉ (Virement bancaire)
```

---

## 2. Les Règles Métier Clés

### BM-PAY-001 — Majoration des Heures Supplémentaires
Les heures supplémentaires effectuées au-delà de la durée légale hebdomadaire (40 heures) font l'objet des majorations légales :
- De la 41ème à la 48ème heure : **Taux horaire majoré de 12 %** (ou barème conventionnel).
- Au-delà de la 48ème heure : **Taux horaire majoré de 35 % à 50 %**.
- Heures de nuit (22h - 05h) : **Taux horaire majoré de 50 %**.
- Dimanches et jours fériés chômés : **Taux horaire majoré de 100 %**.

### BM-PAY-002 — Cotisations Sociales et Plafonnement
- Les cotisations sociales comprennent la **part salariale** (déduite du salaire brut de l'employé) et la **part patronale** (charge supportée directement par l'entreprise).
- Si une caisse de retraite impose un plafond d'assiette (ex: assiette plafonnée à $X$ FCFA par mois) :
  $$\text{Assiette Retraite} = \min(\text{Salaire Brut}, \text{Plafond Légal})$$

### BM-PAY-003 — Déductions pour Charges de Famille (Impôt)
L'impôt sur le revenu salarial (IRPP/ITS) prend en compte la situation de famille déclarée :
- Situation matrimoniale (Célibataire, Marié(e)).
- Nombre d'enfants à charge (mineurs ou étudiants).
- Chaque enfant à charge octroie un abattement fiscal légal sur le montant de l'impôt dû.

### BM-PAY-004 — Déduction des Acomptes sur Salaire
- Tout acompte versé au collaborateur au cours de la période $M$ (ex: le 15 du mois) est automatiquement récapitulé et déduit du montant final viré en fin de mois :
  $$\text{Net Transféré} = \text{Net Théorique} - \sum \text{Acomptes du Mois}$$

### BM-PAY-005 — Verrouillage et Clôture Périodique (Immuabilité)
- Un bulletin de salaire validé et clôturé pour le mois $M$ ne peut plus être modifié.
- **Règle de régularisation :** Toute erreur constatée après clôture (ex: omission d'une prime) ne donne pas lieu à réouverture du bulletin passé, mais à une **ligne de régularisation / rappel sur le bulletin du mois $M+1$**.

### BM-PAY-006 — Barèmes Fiscaux & Paramètres Sociaux Dynamiques (CGI Bénin 2026)
- **Zéro Taux Codé en Dur :** Les tranches de l'ITS (Art. 125 CGI), les taux CNSS (3,6% salarial, 17,4% patronal) et le VPS (4% ou 2%) sont dynamiquement lus depuis le référentiel (`RhBaremeIts`, `RhTauxChargeSociale`).
- **Continuité des Tranches :** Tout barème ITS créé ou modifié valide algorithmiquement l'absence de chevauchements et de trous de montant entre tranches adjacentes.
- **Redevance ORTB (Art. 125-2 CGI) :** Retenue semestrielle automatique (Mars: 1 000 FCFA, Juin: 3 000 FCFA). Les salariés dont le salaire net imposable est inférieur ou égal à 50 000 FCFA (tranche 1 de l'ITS) sont légalement exonérés de la retenue de Juin.
- **Évaluation des Avantages en Nature (Art. 123 CGI 2026) :** Réintégration forfaitaire obligatoire (ex: 15% pour le logement) dans l'assiette brute avant calcul des cotisations et de l'ITS.


---

## 3. Scénario BDD : Calcul du Net à Payer avec Acompte

```gherkin
Fonctionnalité : Clôture du Bulletin de Paie

Scénario : Déduction automatique d'un acompte de milieu de mois
  Étant donné un salarié "KOUAME Jean" avec un salaire net après impôts de 350 000 FCFA
  Et qu'un acompte validé de 100 000 FCFA lui a été versé le 15 septembre
  Quand le gestionnaire RH génère le bulletin de paie final de septembre
  Alors la ligne "Acompte du 15/09" apparaît en déduction de 100 000 FCFA
  Et le "Net à Payer" final figurant sur le bulletin est de 250 000 FCFA
```

---

## 4. Dictionnaire des Erreurs Paie

| Code d'erreur | Description |
|---|---|
| `PAYSLIP_ALREADY_CLOSED` | Tentative d'édition d'un bulletin de salaire déjà clôturé |
| `ADVANCE_EXCEEDS_NET_SALARY` | L'acompte demandé est supérieur au salaire net prévisionnel du mois |
| `ACTIVE_CONTRACT_REQUIRED` | Impossible de générer un bulletin pour un employé sans contrat actif |
| `NEGATIVE_NET_SALARY` | Les déductions et saisies dépassent le brut (interdit par le Code du Travail) |
