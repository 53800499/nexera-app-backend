# 💳 07 — Encaissements, Règlements & Relances d'Impayés

Ce document détaille la logique métier backend des modules `payments`, `reminders` et `clients`.

---

## 1. Imputation Transactionnelle des Paiements (`PaymentsService`)

Lorsqu'un règlement est enregistré, le backend met à jour la facture de manière atomique :

```typescript
await this.prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId, tenantId } });

  if (amountPaid > invoice.amountDue) {
    throw new BadRequestException('PAYMENT_EXCEEDS_REMAINING_AMOUNT: Le montant dépasse le solde dû.');
  }

  const nouveauResteADevoir = invoice.amountDue - amountPaid;
  const nouveauStatut = nouveauResteADevoir === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  // 1. Mise à jour de la facture
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amountDue: nouveauResteADevoir, status: nouveauStatut }
  });

  // 2. Création de l'enregistrement de paiement
  await tx.payment.create({
    data: {
      tenantId,
      invoiceId,
      amount: amountPaid,
      paymentMethod,
      reference,
      paidAt: new Date(),
    }
  });
});
```

---

## 2. Relances d'Impayés & Balance Âgée (`RemindersService`)

### A. Calcul de la Balance Âgée
Le service regroupe les créances non soldées en 5 tranches d'arriérés :
- **Courant (Non échu) :** $\text{dueDate} \ge \text{now}$
- **Retard 1 à 30 jours :** $1 \le \text{jours} \le 30$
- **Retard 31 à 60 jours :** $31 \le \text{jours} \le 60$
- **Retard 61 à 90 jours :** $61 \le \text{jours} \le 90$
- **Retard > 90 jours (Contentieux) :** $\text{jours} > 90$

### B. Contrôle d'Éligibilité à la Relance
Une relance ne peut être envoyée que si :
1. $\text{amountDue} > 0$
2. La facture est émise (`issued`, `sent`, `partial`, `overdue`).
3. Le délai minimal entre deux relances (ex: 7 jours) est respecté pour éviter le harcèlement du client.
