# Rapport & Matrice de Sécurité — Backend Nexera ERP

---

## 1. Modèle de Menaces & Architecture Défensive

En tant que progiciel financier et comptable gérant des flux monétaires et des déclarations fiscales étatiques, **Nexera ERP** applique le principe de défense en profondeur (*Defense in Depth*) articulé sur 5 niveaux :

```
[Niveau 1 : Réseau & Transport]   ──► TLS 1.3 Strict, HSTS, CORS Restrictif
[Niveau 2 : Authentification]     ──► JWT Stateless, Bcrypt >= 10 rounds, Refresh Token rotatif
[Niveau 3 : Contrôle d'Accès]     ──► RBAC Granulaire (@Permissions), Zéro accès implicite
[Niveau 4 : Validation Entrées]   ──► Whitelist class-validator, Assainissement DTO
[Niveau 5 : Base de Données]      ──► PostgreSQL Row Level Security (RLS) Cloisonné
```

---

## 2. Matrice d'Évaluation des Risques OWASP Top 10

| Risque OWASP (2021) | Mesure de Protection Mise en Œuvre dans Nexera | Statut |
| :--- | :--- | :--- |
| **A01 : Broken Access Control** | `PermissionsGuard` systématique + politique native PostgreSQL RLS (`app.current_tenant_id`). | **Mitigé (Natif)** |
| **A02 : Cryptographic Failures** | Hachage Bcrypt avec salage individuel, tokens JWT signés HMAC SHA-256, clés secrètes d'au moins 64 caractères. | **Conforme** |
| **A03 : Injection (SQL, Command)**| Prisma ORM utilise exclusivement des requêtes préparées paramétrées. Aucune concaténation SQL brute. | **Mitigé (Natif)** |
| **A04 : Insecure Design** | Workflow strict d'immuabilité financière : impossibilité de modifier une facture émise sans émettre un avoir. | **Conforme** |
| **A05 : Security Misconfiguration**| Rejet automatique des propriétés non blanches (`forbidNonWhitelisted: true`), masquage des stacktraces en prod. | **Conforme** |
| **A06 : Vulnerable Components** | Audit automatisé des dépendances npm (`npm audit`) intégré au pipeline de build. | **Surveillé** |
| **A07 : Identification Failures** | Expiration rapide des Access Tokens (15 min), invalidation immédiate du Refresh Token lors du logout. | **Conforme** |
| **A08 : Software & Data Integrity**| Signature e-MECeF de la DGI et empreinte SHA-256 de scellement sur le fichier FEC (Arrêté 1085-C). | **Conforme** |
| **A09 : Security Logging Failures**| Table `audit_logs` horodatée traçant toutes les écritures sensibles avec IP et identifiant d'auteur. | **Conforme** |
| **A10 : Server-Side Request Forgery**| Appels externes e-MECeF strictement restreints aux URLs configurées par le tenant et validées. | **Conforme** |

---

## 3. Preuve d'Étanchéité Multi-Tenant par PostgreSQL RLS

Le risque n°1 dans une application SaaS multi-locataires est la fuite de données d'une entreprise vers une autre.

### Pourquoi le filtrage applicatif seul est insuffisant
Dans un code applicatif comptant des centaines de requêtes, un développeur peut par inadvertance oublier la clause `where: { tenantId }` lors d'une jointure complexe.

### La Garantie Mathématique de RLS
Avec RLS activé sur PostgreSQL :
1. Chaque requête HTTP active positionne la variable de session :
   ```sql
   SET LOCAL app.current_tenant_id = 'tenant-xyz';
   ```
2. Le moteur PostgreSQL évalue la politique RLS avant d'exécuter la moindre opération de lecture ou d'écriture :
   ```sql
   tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::text
   ```
3. Si un utilisateur du tenant A tente d'accéder à l'ID d'une facture du tenant B (`/invoices/id-du-tenant-b`), PostgreSQL renvoie un ensemble vide (`0 rows returned`). Le service NestJS retourne alors naturellement une erreur `HTTP 404 Not Found`. L'attaquant ne peut même pas deviner si la ressource existe.

---

## 4. Conformité Réglementaire : Protection des Données (APDP / RGPD)

1. **Minimisation des Données** : Seules les données strictement nécessaires à l'exécution du contrat commercial, du contrat de travail et aux obligations fiscales sont collectées.
2. **Confidentialité de la Paie** : Les données salariales (revenus, cotisations, situation de famille) sont protégées par les permissions exclusives `paie.read` et `paie.calculate`, inaccessibles aux profils commerciaux ou administratifs standards.
3. **Conservation Légale** : Les pièces comptables et justificatifs d'impôt sont conservés de manière inaltérable pendant la durée légale de **10 ans** conformément aux dispositions de l'Acte Uniforme OHADA relatif au droit comptable.
