# 🌴 Ressources Humaines — Congés, Absences & Soldes

Ce document détaille les règles métier de gestion du temps, des congés payés et des absences des collaborateurs dans Nexera.

---

## 1. Les Règles Métier Clés

### BM-RH-001 — Acquisition Mensuelle des Congés Payés
- Conformément au Code du Travail (norme générale zone UEMOA / OHADA) :
  - Un salarié acquiert **2 jours ouvrables** (ou **1,67 jour ouvré**) de congé payé par mois de travail effectif.
  - L'acquisition est calculée au dernier jour de chaque mois civil (`monthly_accrual`).
  - Des majorations d'ancienneté (ex: +1 jour après 5 ans, +2 jours après 10 ans) s'appliquent selon la convention collective de l'entreprise.

### BM-RH-002 — Mode de Décompte des Jours d'Absence
- **Jours Ouvrables :** Tous les jours de la semaine sauf le jour de repos hebdomadaire (dimanche) et les **jours fériés légaux**.
- **Jours Ouvrés :** Les jours réellement travaillés dans l'entreprise (généralement du lundi au vendredi).
- **Règle des jours fériés :** Tout jour férié légal tombant à l'intérieur d'une période de congés ne doit pas être décompté du solde de congés du collaborateur.

### BM-RH-003 — Formule de Calcul du Solde Disponible
$$\text{Solde Disponible} = \text{Cumul Acquis} + \text{Ajustements Validés} - \text{Congés Pris (Consommés)} - \text{Congés en Demande (Réservés)}$$

- Un collaborateur ne peut pas soumettre une demande excédant son solde disponible, sauf si la politique du Tenant autorise l'anticipation (`allow_advance_leave = true`).

### BM-RH-004 — Non-Chevauchement des Demandes
- Un collaborateur ne peut avoir deux absences (qu'il s'agisse de congés payés, maladie ou permission) qui se chevauchent sur la même plage de dates :
  $$\text{Nouvelle Absence} \cap \text{Absence Existante non rejetée} = \emptyset$$

---

## 2. Workflow d'Approbation d'un Congé

```text
               ┌──────────┐
               │  DRAFT   │ (Création par le collaborateur)
               └────┬─────┘
                    │ Soumettre à la hiérarchie
                    ▼
           ┌─────────────────┐
           │    SUBMITTED    │ ◄─── Réserve temporairement les jours sur le solde
           └────────┬────────┘
                    │
         ┌──────────┴──────────┐
         │ Validé par Manager  │ Rejeté par Manager
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│    APPROVED     │   │    REJECTED     │ ◄─── Libère les jours réservés
└────────┬────────┘   └─────────────────┘
         │
         │ Demande d'annulation acceptée
         ▼
┌─────────────────┐
│    CANCELLED    │ ◄─── Crédite à nouveau le solde
└─────────────────┘
```

---

## 3. Scénarios Métier Vérifiables (BDD / Gherkin)

```gherkin
Fonctionnalité : Demande de congés payés

Scénario : Dépassement du solde de congés disponible
  Étant donné un collaborateur avec un solde disponible de 3 jours de congés
  Et l'option "allow_advance_leave" désactivée pour l'entreprise
  Quand le collaborateur tente de poser une demande pour une période de 5 jours
  Alors le système refuse la soumission avec l'erreur "INSUFFICIENT_LEAVE_BALANCE"
  Et aucune demande n'est créée

Scénario : Exclusion automatique des jours fériés légaux
  Étant donné une demande de congés du lundi 1er août au vendredi 5 août (5 jours ouvrés)
  Et que le mercredi 3 août est un jour férié légal chômé (Fête de l'Indépendance)
  Quand la durée de la demande est calculée
  Alors le nombre de jours décomptés est exactement de 4 jours (et non 5)
```

---

## 4. Dictionnaire des Erreurs Congés & Absences

| Code d'erreur | Description |
|---|---|
| `INSUFFICIENT_LEAVE_BALANCE` | Le solde disponible est insuffisant pour couvrir la durée |
| `OVERLAPPING_LEAVE_REQUEST` | Une autre demande validée ou en cours existe déjà sur cette période |
| `LEAVE_CANNOT_BE_MODIFIED` | La demande a déjà été approuvée ou consommée |
| `ADJUSTMENT_REASON_REQUIRED`| Un ajustement manuel de solde par les RH exige un motif documenté |
