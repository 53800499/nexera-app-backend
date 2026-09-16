# Stratégie de Tests & Assurance Qualité — Backend Nexera ERP

---

## 1. Pyramide des Tests Nexera

La qualité et la fiabilité financière du backend de **Nexera ERP** reposent sur une pyramide de tests à 4 niveaux :

```
                  / \
                 /   \
                / E2E \           Tests End-to-End (Supertest)
               /-------\
              /  SMOKE  \         Smoke Tests Commerciaux & Sync
             /-----------\
            / INTÉGRATION \       Tests d'Intégration DB & Services
           /---------------\
          /    UNITAIRES    \     Tests Unitaires Jest (*.spec.ts)
         /-------------------\
```

1. **Tests Unitaires (Unit Tests)** : Validation isolée de la logique algorithmique pure (calculs de paie, ventilation TVA e-MECeF, génération séquentielle de numérotation, conversion de devises).
2. **Tests d'Intégration** : Validation des interactions entre les services et la couche de persistance Prisma, gestion des transactions complexes et intégrité référentielle.
3. **Smoke Tests Automatisés** : Scripts Node.js exécutant des parcours utilisateurs complets de bout en bout simulant un environnement réel.
4. **Tests End-to-End (E2E)** : Validation HTTP complète via Supertest sur une instance NestJS éphémère avec base de données dédiée.

---

## 2. Tests Unitaires & Mocking des Dépendances

Les tests unitaires sont exécutés par **Jest** (`ts-jest`). Chaque service métier dispose de son fichier de test unitaire jumeau (ex. `invoices.service.spec.ts`, `mecef-client.service.spec.ts`, `calcul-paie.service.spec.ts`).

### Patron Standard de Mocking Prisma
Les tests unitaires ne contactent jamais la base de données réelle ; ils utilisent un mock typé de `PrismaService` :

```typescript
describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: {
            invoice: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('doit rejeter l’émission d’une facture sans lignes d’articles', async () => {
    await expect(service.issueInvoice('tenant-1', 'inv-vide')).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

---

## 3. Smoke Tests Applicatifs Automatisés

Le backend inclut des scripts de validation opérationnelle exécutables directement en ligne de commande :

### 3.1 Smoke Test Commercial (`npm run smoke:commercial`)
Fichier : `scripts/smoke-commercial-flow.mjs`
- **Objectif** : Valide le cycle de vie complet de vente en 6 étapes :
  1. Authentification d'un utilisateur commercial.
  2. Création d'un client avec IFU valide.
  3. Émission d'un devis avec deux lignes d'articles et TVA 18%.
  4. Conversion automatique du devis en facture de vente.
  5. Normalisation fiscale de la facture (e-MECeF).
  6. Enregistrement d'un encaissement et clôture du solde dû.

### 3.2 Smoke Test de Synchronisation Hors-Ligne (`npm run smoke:sync`)
Fichier : `scripts/smoke-offline-sync.mjs`
- **Objectif** : Simule la saisie de 10 factures sur un terminal hors-ligne, la reconnexion au serveur, l'envoi du lot (*batch*) de synchronisation et la résolution des compteurs séquentiels sans conflit.

---

## 4. Matrice des Suites de Tests et Commandes d'Exécution

| Type de Test | Commande | Fréquence d'Exécution | Durée Moyenne |
| :--- | :--- | :--- | :--- |
| **Tests Unitaires** | `npm test` | En continu lors du développement | ~ 15 secondes |
| **Mode Surveillance** | `npm run test:watch` | En développement actif sur un module | Immédiat à la sauvegarde |
| **Rapport de Couverture**| `npm run test:cov` | Avant chaque pull request | ~ 45 secondes |
| **Tests End-to-End** | `npm run test:e2e` | En intégration continue (CI) | ~ 2 minutes |
| **Smoke Test Commercial**| `npm run smoke:commercial` | Post-déploiement / Staging | ~ 5 secondes |
| **Smoke Test Sync** | `npm run smoke:sync` | Post-déploiement / Staging | ~ 4 secondes |

---

## 5. Critères d'Acceptation & Qualité (Quality Gates)

Pour qu'une modification soit fusionnée et déployable en production :
1. **Zéro Échec** : 100% des tests unitaires et E2E doivent être au vert.
2. **Couverture Minimale** :
   - Modules critiques (Facturation, e-MECeF, Paie OHADA, Fiscalité/FEC) : **>= 85% de couverture des lignes**.
   - Autres modules (CRM, Catalogue, Paramètres) : **>= 70%**.
3. **Audit de Sécurité** : `npm audit --omit=dev` ne doit remonter aucune vulnérabilité critique ou élevée.
