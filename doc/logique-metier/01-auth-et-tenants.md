# 🔐 01 — Authentification, Multi-Tenant & Utilisateurs

Ce document détaille la logique métier et la sécurité des modules `auth`, `tenants`, `users`, `roles` et `permissions`.

---

## 1. Modèle Multi-Tenant & Cloisonnement Strict

Nexera héberge de multiples entreprises au sein d'une même base de données PostgreSQL. La sécurité repose sur le principe d'**étanchéité absolue** :

```text
REQUÊTE HTTP ENTRANTE
         │
         ▼
[ JwtAuthGuard & JwtStrategy ]
Valide le token Bearer, extrait : { sub (userId), tenantId, isSuperAdmin }
         │
         ▼
[ TenantContextInterceptor ]
Injecte le `tenantId` dans le contexte d'exécution
         │
         ▼
[ Service Métier NestJS ]
Chaque appel Prisma inclut OBLIGATOIREMENT :
`where: { id, tenantId }` ou `where: { tenantId }`
```

> ⚠️ **Règle absolue :** Aucune méthode de service ne doit interroger ou modifier une ressource par son seul `id` sans filtrer conjointement sur `tenantId`, sauf pour le rôle `SUPER_ADMIN` dans les opérations d'infrastructure technique.

---

## 2. Cycle de Vie de l'Authentification

### A. Connexion (`AuthService.login`)
1. Normalisation de l'email : `dto.email.toLowerCase().trim()`.
2. Recherche de l'utilisateur avec ses rôles et permissions :
   ```typescript
   const user = await this.prisma.user.findUnique({
     where: { email },
     include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
   });
   ```
3. Vérification du compte :
   - Si `!user` ou `!user.isActive` : levée d'une `UnauthorizedException('Identifiants invalides ou compte inactif')`.
4. Vérification du mot de passe avec `bcrypt.compare(password, user.password)`.
5. Génération de la paire de jetons :
   - `accessToken` : Durée courte (15 minutes).
   - `refreshToken` : Durée longue (7 jours), hashé avec bcrypt et persisté dans `user.refreshToken`.

### B. Réinitialisation de Mot de Passe (`PasswordResetToken`)
- Un token aléatoire cryptographique de 32 octets est généré.
- Le hash SHA-256 du token est stocké dans la table `password_reset_tokens` avec une validité de 60 minutes.
- Dès utilisation, le token est marqué `usedAt: new Date()` et ne peut plus jamais être rejoué.

---

## 3. Matrice des Rôles & Permissions

Chaque rôle est rattaché à un `tenantId` (sauf les rôles systèmes globaux). Les permissions sont formées selon le modèle `domaine:action` :

```typescript
// Exemple de vérification dans un contrôleur ou un guard
@RequirePermissions('invoice:validate')
@Post(':id/validate')
async validateInvoice(@Param('id') id: string, @CurrentTenant() tenantId: string) {
  return this.invoicesService.validate(id, tenantId);
}
```
