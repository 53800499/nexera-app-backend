# Spécifications Techniques Détaillées (STD) — Backend Nexera ERP

---

## 1. Gestion des Transactions Financières & Consistance

### 1.1 Principe Transactionnel
Toute opération métier impliquant des modifications croisées (ex. création d'une facture, décrémentation des stocks et mise à jour de l'encours client) est encapsulée dans une transaction interactive Prisma (`prisma.$transaction`) avec niveau d'isolation par défaut `Read Committed` de PostgreSQL.

```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Mise à jour de la facture (passage au statut issued)
  const issuedInvoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.ISSUED, number: generatedNumber },
  });

  // 2. Décrémentation des stocks si l'article est suivi en inventaire
  for (const line of invoice.lines) {
    if (line.item && line.item.trackStock) {
      await tx.stockMovement.create({
        data: {
          tenantId,
          itemId: line.itemId,
          type: StockMovementType.OUT,
          quantity: line.quantity,
          reference: issuedInvoice.number,
        },
      });
    }
  }

  // 3. Mise à jour de la balance client
  await tx.client.update({
    where: { id: invoice.clientId },
    data: { currentBalance: { increment: invoice.totalTtc } },
  });
});
```

En cas d'exception ou d'échec d'une seule étape, la totalité des opérations est annulée (*rollback* atomique), garantissant l'absence absolue d'écritures orphelines.

---

## 2. Conception du Moteur PDF & Génération de Documents

### 2.1 Architecture du Moteur (`document-pdf.builder.ts`)
Le moteur de rendu documentaire PDF est conçu pour être 100% vectoriel, prévisible et ultra-performant. Il ne nécessite aucun composant externe binaire.

- **Classe Principale** : `DocumentPdfBuilder`
- **Résolution & Layout** : Format standard A4 (595.28 x 841.89 points), marges fixes de 36 points.
- **Gestion des Débordements de Page** : Découpage automatique des lignes de facturation avec ré-émission de l'en-tête de tableau sur les pages supplémentaires.
- **Empreinte Mémoire** : Flux en streaming direct dans un buffer binaire (`Buffer.concat`) libéré immédiatement après envoi au client HTTP.

### 2.2 Sceau Cryptographique & QR Code e-MECeF
Lorsqu'une facture est certifiée, le générateur PDF exécute les étapes suivantes :
1. Génération d'une image matricielle PNG en mémoire via la bibliothèque `qrcode` à partir de l'URL officielle DGI :
   ```typescript
   const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
     width: 120,
     margin: 1,
     errorCorrectionLevel: 'M',
     color: { dark: '#064e3b', light: '#ffffff' }
   });
   ```
2. Insertion du QR Code dans le bloc fiscal de bas de facture, accompagné du texte officiel :
   - *« Facture certifiée conforme par la Direction Générale des Impôts du Bénin »*
   - *« NIM : [NIM] | Compteurs : [MC/TC] [TYPE] »*
   - *« Code MECeF : [BJ01-XXXX-XXXX-XXXX-XXXX] »*

---

## 3. Validation des Données d'Entrée & Traitement des Exceptions

### 3.1 Pipeline de Validation Global
Toute requête HTTP est soumise à la `ValidationPipe` déclarée dans `main.ts` :

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // Supprime silencieusement les champs non déclarés
    forbidNonWhitelisted: true, // Rejette avec HTTP 400 si des propriétés interdites sont envoyées
    transform: true,            // Convertit automatiquement les types (ex. string -> number)
    exceptionFactory: validationExceptionFactory, // Formateur d'erreurs unifié
  }),
);
```

### 3.2 Format Unifié des Erreurs API
En cas d'erreur métier ou de validation, l'API renvoie toujours un schéma JSON standardisé :

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "errors": [
    {
      "field": "taxGroup",
      "messages": ["taxGroup must be one of the following values: A, B, C, D, E, F"]
    }
  ],
  "timestamp": "2026-09-16T10:15:30.123Z",
  "path": "/api/invoices/normalize"
}
```

---

## 4. Résilience & Intégration Externe e-MECeF

### 4.1 Contrôle des Délais & Timeout
Les appels réseau vers l'API de la DGI (`callExternalMecefApi`) sont strictement encadrés par un `AbortController` avec un délai d'expiration maximal de **10 000 ms (10 secondes)** :

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // ... traitement de la réponse
} catch (err: any) {
  clearTimeout(timeoutId);
  if (err.name === 'AbortError') {
    throw new GatewayTimeoutException('Le serveur e-MECeF DGI n’a pas répondu dans le délai imparti (10s).');
  }
  throw err;
}
```

### 4.2 Traitement des Échecs & Reprise
Si l'appel DGI échoue (timeout, rejet fiscal ou indisponibilité réseau) :
1. Le statut de la facture bascule sur `failed`.
2. Le message d'erreur retourné par la DGI est consigné dans `mecefErrorMessage`.
3. La facture n'est pas bloquée définitivement : l'utilisateur dispose d'un bouton de reprise « Réessayer e-MECeF » pour relancer la certification sans re-créer la facture.

---

## 5. Tâches Planifiées en Arrière-Plan (Cron Jobs)

Le backend utilise le module `@nestjs/schedule` pour orchestrer les traitements récurrents automatisés :

| Tâche Planifiée | Fréquence (Cron) | Objectif & Description |
| :--- | :--- | :--- |
| **Relances Automatiques** | `0 8 * * 1-5` (Chaque jour ouvré à 8h) | Détecte les factures échues, calcule le niveau de relance (1, 2 ou 3) et expédie les emails. |
| **Facturation Récurrente** | `0 1 * * *` (Chaque nuit à 1h) | Génère automatiquement les factures d'abonnement selon la périodicité paramétrée. |
| **Purge des Fichiers Temporaires** | `0 3 * * 0` (Chaque dimanche à 3h) | Nettoie les caches de prévisualisation PDF expirés et les fichiers d'export anciens. |
| **Vérification des Stocks Mini** | `0 7 * * *` (Chaque matin à 7h) | Calcule les articles proches de la rupture et génère des alertes pour les approvisionnements. |
