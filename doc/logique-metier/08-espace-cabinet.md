# 🏢 08 — Espace Cabinet & Délégation Multi-Dossiers

Ce document détaille la logique métier backend du module `cabinet`.

---

## 1. Protocole de Liaison Sécurisée Cabinet ↔ Entreprise

1. **Génération du Code :** L'entreprise cliente génère un code à usage unique valable 48h (`CabinetInviteCode`).
2. **Réclamation par le Cabinet :** Le collaborateur du cabinet soumet le code (`POST /api/cabinet/link/claim`).
3. **Double Consentement :** Le lien est activé (`status: ACTIVE`) après confirmation formelle de l'entreprise.
4. **Révocation Instantanée :** L'entreprise peut révoquer l'accès à tout instant (`POST /api/cabinet/link/revoke`), invalidant immédiatement tous les accès du cabinet à son dossier.

---

## 2. Interception des Requêtes en Mode Délégué (`CabinetGuard`)

Lorsqu'un membre d'un cabinet consulte les données d'un client :
1. La requête HTTP transmet l'en-tête : `X-Cabinet-Delegated-Tenant: <clientTenantId>`.
2. Le `CabinetGuard` vérifie :
   ```typescript
   const link = await this.prisma.cabinetClientLink.findFirst({
     where: {
       cabinetTenantId: user.tenantId,
       clientTenantId: delegatedTenantId,
       status: 'ACTIVE'
     }
   });

   if (!link) {
     throw new ForbiddenException('CABINET_ACCESS_REVOKED: Vous n\'avez pas de mandat actif sur ce dossier.');
   }
   ```
3. Le contexte d'exécution permute le `tenantId` actif vers celui de l'entreprise cliente pour la durée de la requête.

---

## 3. Double Imputation dans le Journal d'Audit
Toute écriture réalisée par un membre du cabinet enregistre systématiquement :
- `userId` : L'identifiant de l'expert ou du collaborateur physique.
- `cabinetId` : L'identifiant du cabinet mandataire.
- `tenantId` : L'identifiant de l'entreprise cliente propriétaire de la donnée.
