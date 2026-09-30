# 🔄 Référentiel Global des Machines à États & Transitions

Ce document centralise toutes les machines à états (State Machines) de Nexera afin de garantir la cohérence des cycles de vie entre le Front-end et le Back-end.

---

## 1. Vue Récapitulative des Entités à États

| Entité | États Possibles | État Final / Verrouillé |
|---|---|---|
| **Facture** | `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE` | `PAID` (ou neutralisée par Avoir) |
| **Devis** | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` | `ACCEPTED` / `REJECTED` / `EXPIRED` |
| **Avoir** | `DRAFT`, `ISSUED`, `APPLIED` | `APPLIED` |
| **Demande de Congé** | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED` | `APPROVED` / `REJECTED` / `CANCELLED` |
| **Note de Frais** | `DRAFT`, `SUBMITTED`, `APPROVED_MGR`, `VALIDATED_COMPTA`, `PAID`, `REJECTED` | `PAID` / `REJECTED` |
| **Session Inventaire** | `DRAFT`, `IN_PROGRESS`, `VALIDATED`, `CANCELLED` | `VALIDATED` / `CANCELLED` |
| **Déclaration Fiscale** | `DRAFT`, `CALCULATED`, `FILED`, `PAID` | `PAID` |

---

## 2. Matrice des Transitions Autorisées & Interdites

### 1. Factures Ventes (`Invoice`)

| État Actuel | Vers `DRAFT` | Vers `ISSUED` | Vers `PARTIALLY_PAID` | Vers `PAID` | Vers `OVERDUE` |
|---|:---:|:---:|:---:|:---:|:---:|
| `DRAFT` | — | ✅ (Émission) | ❌ Interdit | ❌ Interdit | ❌ Interdit |
| `ISSUED` | ❌ Interdit | — | ✅ (Acompte) | ✅ (Paiement intégral) | ✅ (Date dépassée) |
| `PARTIALLY_PAID` | ❌ Interdit | ❌ Interdit | — | ✅ (Solde payé) | ✅ (Date dépassée) |
| `PAID` | ❌ Interdit | ❌ Interdit | ❌ Interdit | — | ❌ Interdit |
| `OVERDUE` | ❌ Interdit | ❌ Interdit | ✅ (Acompte) | ✅ (Paiement) | — |

> 🚫 **Règle absolue :** Aucun retour vers l'état `DRAFT` n'est possible dès lors qu'une facture a atteint `ISSUED`.

---

### 2. Demandes d'Absences & Congés (`LeaveRequest`)

```text
       ┌──────────┐
       │  DRAFT   │
       └────┬─────┘
            │ Soumission par le collaborateur
            ▼
       ┌──────────┐
       │SUBMITTED │
       └────┬─────┘
            ├─────────────────────────────────┐
            │ Validation Manager              │ Rejet Manager
            ▼                                 ▼
       ┌──────────┐                     ┌──────────┐
       │ APPROVED │                     │ REJECTED │
       └────┬─────┘                     └──────────┘
            │ Annulation exceptionnelle
            ▼
       ┌──────────┐
       │CANCELLED │
       └──────────┘
```

#### Règles de Verrouillage des Congés :
- Un congé au statut `APPROVED` ne peut plus être modifié par le salarié.
- Une annulation après approbation nécessite une action conjointe du gestionnaire RH pour réajuster le compteur de solde.

---

### 3. Notes de Frais (`ExpenseReport`)

```text
[ DRAFT ] ──(Soumission)──► [ SUBMITTED ]
                                  │
                                  ├──(Rejet Manager)──► [ REJECTED ]
                                  │
                                  ▼
                          [ APPROVED_MGR ]
                                  │
                                  ├──(Rejet Comptable)──► [ REJECTED ]
                                  │
                                  ▼
                        [ VALIDATED_COMPTA ]
                                  │
                                  ▼ (Virement bancaire)
                              [ PAID ]
```

---

## 3. Implémentation Type dans le Code (NestJS Service)

Chaque transition d'état doit être validée par une fonction de garde (State Guard) pour éviter tout changement d'état illégitime :

```typescript
export function assertValidTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): void {
  const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED],
    [InvoiceStatus.ISSUED]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
    [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
    [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
    [InvoiceStatus.PAID]: [], // État terminal
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    throw new BadRequestException(
      `Transition d'état interdite : impossible de passer de ${currentStatus} à ${newStatus}`
    );
  }
}
```
