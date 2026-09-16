# Guide du Développeur & Standards de Code — Backend Nexera ERP

---

## 1. Arborescence du Projet & Organisation des Fichiers

Le code source réside dans le répertoire `src/` et suit une structure rigoureuse :

```
back-end/src/
├── app.controller.ts            # Contrôleur racine de l'application
├── app.module.ts                # Module racine orchestrant les dépendances
├── app.service.ts               # Service applicatif de base
├── main.ts                      # Point d'entrée bootstrap NestJS (port, CORS, pipes)
│
├── common/                      # Composants transversaux NestJS
│   ├── decorators/              # Décorateurs personnalisés (@Permissions, @Public, @CurrentUser)
│   ├── filters/                 # Filtres d'exceptions HTTP globaux
│   ├── guards/                  # Guards de sécurité (JwtAuthGuard, PermissionsGuard)
│   ├── interceptors/            # Interceptors (TenantRlsInterceptor, LoggingInterceptor)
│   ├── middleware/              # Middlewares HTTP (TenantUserMiddleware, CorrelationId)
│   ├── pipes/                   # Pipes de validation et transformation de données
│   ├── strategies/              # Stratégies Passport (JwtStrategy, LocalStrategy)
│   └── utils/                   # Utilitaires génériques (validation-exception.util)
│
├── config/                      # Modules et chargeurs de configuration
│   └── swagger.ts               # Configuration et initialisation de Swagger OpenAPI
│
├── health/                      # Probes de monitoring et de santé applicative
│   ├── health.controller.ts     # Routes /health, /health/liveness, /health/readiness
│   └── health.module.ts
│
├── infrastructure/              # Adaptateurs d'infrastructure technique
│   └── database/                # PrismaService et gestion du cycle de vie de connexion DB
│
├── modules/                     # Modules métiers (Domain Modules) - 23 modules
│   ├── auth/                    # Authentification, sessions et jetons JWT
│   ├── cabinet/                 # Espace cabinet d'expertise comptable
│   ├── catalogue/               # Gestion des articles, services et tarifs
│   ├── clients/                 # Gestion des tiers clients et contacts
│   ├── fiscalite/               # Déclarations TVA, AIB et export FEC
│   ├── invoices/                # Facturation, avoirs et normalisation e-MECeF
│   │   ├── dto/                 # Objets de transfert de données (Data Transfer Objects)
│   │   ├── entities/            # Modèles de domaine typés
│   │   ├── enums/               # Énumérations (InvoiceStatus, MecefTaxGroup, MecefAibType)
│   │   ├── events/              # Événements métier (InvoiceNormalizedEvent)
│   │   ├── services/            # Logique métier spécialisée (MecefClientService, InvoicePdfService)
│   │   ├── invoices.controller.ts
│   │   ├── invoices.module.ts
│   │   └── invoices.service.ts
│   ├── notes-frais/             # Notes de frais, justificatifs et avances
│   ├── payments/                # Encaissements et imputations
│   ├── quotations/              # Devis et chiffrages
│   ├── rh/                      # Ressources humaines et moteur de paie OHADA
│   └── stock/                   # Gestion des stocks et valorisation PMP
│
└── shared/                      # Services utilitaires partagés
    ├── events/                  # Bus d'événements interne réactif (IntegrationEventsModule)
    ├── metrics/                 # Métriques Prometheus et middleware de chronométrage
    └── pdf/                     # Moteur vectoriel de rendu PDF (DocumentPdfBuilder)
```

---

## 2. Conventions de Nommage & Standards TypeScript

| Élément | Convention | Exemple |
| :--- | :--- | :--- |
| **Fichiers** | `kebab-case.suffix.ts` | `mecef-client.service.ts`, `invoice-status.enum.ts` |
| **Classes & Types** | `PascalCase` | `InvoiceEntity`, `MecefTaxGroupBreakdownDto` |
| **Interfaces** | `PascalCase` (sans préfixe `I`) | `PdfMetadata`, `InvoiceEventPayload` |
| **Méthodes & Variables**| `camelCase` | `normalizeInvoice()`, `totalTtc` |
| **Constantes Globales** | `UPPER_SNAKE_CASE` | `DEFAULT_CURRENCY`, `MECEF_AIB_RATES` |
| **Énumérations (Enums)**| `PascalCase` pour le nom, `UPPER_SNAKE_CASE` ou `lowercase` pour les valeurs | `enum MecefTaxGroup { A = 'A', B = 'B' }` |
| **Tables SQL (Prisma)** | `snake_case` au pluriel via `@@map` | `@@map("invoices")`, `@@map("audit_logs")` |
| **Colonnes SQL** | `snake_case` via `@map` | `tenantId String @map("tenant_id")` |

---

## 3. Guide Pas-à-Pas : Comment Créer ou Étendre un Module

Pour ajouter une nouvelle fonctionnalité conforme à l'architecture Nexera, suivez ce patron standardisé en 6 étapes :

### Étape 1 : Déclaration dans le Schéma Prisma
Modifiez `prisma/schema.prisma` pour ajouter le modèle ou les colonnes requises avec le champ obligatoire `tenantId` :
```prisma
model PurchaseOrder {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  number    String   @unique
  totalHt   Float    @map("total_ht")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("purchase_orders")
}
```
Appliquez ensuite la migration locale avec `npx prisma migrate dev --name add_purchase_orders`.

### Étape 2 : Définition des DTOs avec Validation & Swagger
Créez les fichiers DTO dans `src/modules/[module]/dto/` en décorant chaque propriété pour Swagger et `class-validator` :
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'CMD-FOURN-2026-001', description: 'Référence de commande' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ example: 150000, description: 'Montant total HT' })
  @IsNumber()
  @Min(0)
  totalHt!: number;
}
```

### Étape 3 : Écriture du Service Métier
Injectez `PrismaService` et concevez les méthodes métier en garantissant l'isolation du tenant :
```typescript
@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePurchaseOrderDto) {
    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }
}
```

### Étape 4 : Conception du Contrôleur Sécurisé
Décorez les routes avec les autorisations appropriées :
```typescript
@ApiTags('Bons de Commande Fournisseurs')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  @Permissions('purchases.create')
  @ApiOperation({ summary: 'Créer un bon de commande fournisseur' })
  create(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.service.create(req.user.tenantId, dto);
  }
}
```

### Étape 5 : Enregistrement dans le Module
Déclarez contrôleurs et services dans le module NestJS et importez-le dans `app.module.ts`.

### Étape 6 : Tests Unitaires
Rédigez le fichier `purchase-orders.service.spec.ts` avec Jest en simulant `PrismaService` via un mock déterministe.

---

## 4. Outils d'Assurance Qualité & Formatage

Le projet intègre une chaîne d'outillage automatisée :
- **Linter** : ESLint 9 avec configuration moderne `eslint.config.mjs` garantissant le respect des règles TypeScript strictes.
- **Formateur** : Prettier 3 configuré dans `.prettierrc` (guillemets simples, point-virgules obligatoires, trailing comma ES5).
- **Commandes Utiles** :
  ```bash
  # Vérifier et corriger automatiquement le style de code
  npm run lint
  npm run format

  # Compiler et valider l'absence d'erreurs de typage
  npm run build
  ```
