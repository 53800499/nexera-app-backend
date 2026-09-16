# Guide de Déploiement & DevOps — Backend Nexera ERP

---

## 1. Environnements d'Exécution

Le cycle de vie applicatif de **Nexera ERP** est structuré en trois environnements étanches :

```
[Développement Local] ────► [Staging / Homologation] ────► [Production]
  - PostgreSQL local          - Cloud Render / Staging       - Cloud Render / Multi-AZ
  - Mode Sandbox e-MECeF      - Mode Sandbox e-MECeF         - Mode Production API DGI
  - Hot reload (nest start)   - Build dist/ optimisé         - Haute disponibilité & RLS
```

---

## 2. Déploiement Conteneurisé avec Docker

### 2.1 Fichier Dockerfile Optimisé (Multi-Stage Build)
Le backend est packagé dans une image Docker légère basée sur `node:20-alpine` :

```dockerfile
# Stage 1: Build & Compilation
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# Stage 2: Image de Production Légère
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### 2.2 Orchestration Locale (`docker-compose.yml`)
En environnement local ou sur serveur dédié, l'application et sa base PostgreSQL sont démarrées en une seule commande :

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: nexera_db
    environment:
      POSTGRES_USER: nexera_user
      POSTGRES_PASSWORD: secret_db_password
      POSTGRES_DB: nexera_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## 3. Déploiement Cloud sur Render (`render.yaml`)

Nexera est pré-configuré pour un déploiement continu automatisé sur la plateforme Cloud Render via le fichier `render.yaml` :

```yaml
services:
  - type: web
    name: nexera-backend
    env: node
    plan: standard
    buildCommand: npm ci && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: API_PREFIX
        value: api
      - key: DATABASE_URL
        fromDatabase:
          name: nexera-postgres
          property: connectionString
```

Lors de chaque push sur la branche principale `main`, Render déclenche automatiquement :
1. L'installation propre des dépendances (`npm ci`).
2. La régénération des types Prisma (`prisma generate`).
3. La compilation NestJS (`nest build`).
4. L'application des migrations de schéma en base de données (`prisma migrate deploy`).
5. Le démarrage du serveur et la validation de la sonde `/health`.

---

## 4. Dictionnaire des Variables d'Environnement

| Variable | Exemple / Format | Obligatoire | Rôle & Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | **Oui** | Chaîne de connexion PostgreSQL principale (utilisée avec pool). |
| `DIRECT_URL` | `postgresql://user:pass@host:5432/db` | Optionnel | Connexion directe sans proxy (requise par Supabase / Neon pour migrations). |
| `JWT_SECRET` | Chaîne aléatoire >= 64 caractères | **Oui** | Clé secrète de signature des Access Tokens JWT. |
| `JWT_REFRESH_SECRET`| Chaîne aléatoire >= 64 caractères | **Oui** | Clé secrète de signature des Refresh Tokens. |
| `JWT_EXPIRATION` | `15m` | Non (défaut `15m`) | Durée de validité de l'Access Token. |
| `JWT_REFRESH_EXPIRATION`| `7d` | Non (défaut `7d`) | Durée de validité du Refresh Token. |
| `NODE_ENV` | `production` ou `development` | **Oui** | Environnement d'exécution NestJS. |
| `PORT` | `3008` (ou `10000` sur Render) | Non (défaut `3000`) | Port d'écoute HTTP du serveur. |
| `CORS_ORIGIN` | `https://app.nexera.bj,https://admin.nexera.bj` | **Oui** | Liste des origines autorisées séparées par des virgules. |
| `API_PREFIX` | `api` | Non (défaut `api`) | Préfixe d'accès global de toutes les routes de l'API. |
| `FRONT_APP_URL` | `https://app.nexera.bj` | **Oui** | URL racine du frontend pour les liens dans les emails transactionnels. |
| `MAIL_ENABLED` | `true` ou `false` | Non (défaut `false`)| Active ou désactive l'envoi réel des emails. |
| `SMTP_HOST` | `smtp.sendgrid.net` | Si mail activé | Hôte du serveur SMTP d'expédition. |
| `SMTP_PORT` | `587` ou `465` | Si mail activé | Port de connexion SMTP. |
| `SMTP_USER` | `apikey` | Si mail activé | Nom d'utilisateur ou clé API SMTP. |
| `SMTP_PASS` | `secret_password` | Si mail activé | Mot de passe SMTP. |
| `SMTP_FROM` | `"Nexera ERP" <facturation@nexera.bj>` | Si mail activé | Adresse de l'expéditeur affichée aux clients. |

---

## 5. Checklist de Mise en Production (Release Checklist)

Avant toute ouverture au public ou bascule en production réelle :
- [ ] **Base de Données** : Sauvegarde intégrale snapshot / pg_dump effectuée.
- [ ] **Secrets** : `JWT_SECRET` et `JWT_REFRESH_SECRET` régénérés avec des clés cryptographiques uniques.
- [ ] **e-MECeF** : Clé API DGI de production renseignée et vérifiée via `GET /api/invoices/mecef/config`.
- [ ] **CORS** : `CORS_ORIGIN` restreint exclusivement aux noms de domaine officiels du frontend.
- [ ] **Supervision** : Sonde `/health` opérationnelle et connectée aux alertes de disponibilité.
- [ ] **Certificats SSL/TLS** : HTTPS actif avec redirection automatique du trafic HTTP non sécurisé.
