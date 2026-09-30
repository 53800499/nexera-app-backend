# 🏢 Espace Cabinet Comptable — Multi-Dossiers, Délégation & Audit

Ce document décrit les règles métier régissant les interactions entre les entreprises clientes et les cabinets comptables externes partenaires dans Nexera.

---

## 1. Modèle de Collaboration Cabinet ↔ Entreprise

Nexera permet à un cabinet d'expertise comptable de superviser un portefeuille de clients au sein d'une interface unifiée, tout en garantissant une étanchéité absolue entre chaque dossier :

```text
                  ┌────────────────────────────────────────┐
                  │       CABINET D'EXPERTISE ABC          │
                  │   (Collaborateurs, Experts-Comptables) │
                  └──────────────────┬─────────────────────┘
                                     │
                     ┌───────────────┼───────────────┐
       Mandat Actif  │  Mandat Actif │  Mandat Actif │
                     ▼               ▼               ▼
              ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
              │ ENTREPRISE  │ │ ENTREPRISE  │ │ ENTREPRISE  │
              │  CLIENTE 1  │ │  CLIENTE 2  │ │  CLIENTE 3  │
              └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 2. Les Règles Métier Clés

### BM-CAB-001 — Cycle de Liaison par Code Sécurisé
1. Pour déléguer son dossier à un cabinet, l'administrateur de l'entreprise cliente génère un **Code d'Invitation Unique** (`CabinetInviteCode`), valable pour une durée limitée (ex: 48 heures).
2. Le collaborateur du cabinet saisit ce code dans son espace cabinet.
3. Le lien est établi au statut `PENDING_CONFIRMATION` jusqu'à acceptation formelle par le gérant de l'entreprise.
4. Une fois confirmé, le lien passe à l'état `ACTIVE`.

### BM-CAB-002 — Matrice des Permissions Déléguées
L'entreprise cliente choisit précisément les droits qu'elle accorde au cabinet :

| Module | Droits Standard Cabinet | Option Restrictive Client |
|---|---|---|
| **Facturation & Ventes** | Consultation & Écritures d'ajustement | Consultation seule |
| **Stocks & Achats** | Consultation des inventaires et valorisations | Consultation seule |
| **Fiscalité & Déclarations** | Plein pouvoir (calcul, validation, télédéclaration) | Soumission soumise à accord DG |
| **RH & Paie** | Consultation des charges et écritures de paie | **Accès masqué aux salaires nominatifs** |
| **Export FEC / Grand Livre** | Génération et téléchargement | Autorisé par défaut |

### BM-CAB-003 — Souveraineté des Données et Révocation Unilatérale
- **L'entreprise cliente reste la propriétaire exclusive de ses données.**
- À tout instant, l'administrateur de l'entreprise cliente peut cliquer sur **« Révoquer l'accès du cabinet »**.
- Dès la révocation :
  - Le lien passe immédiatement au statut `REVOKED`.
  - Tous les tokens d'accès des collaborateurs du cabinet vers ce Tenant sont invalidés sur-le-champ.
  - Aucune nouvelle lecture ou écriture n'est autorisée.

### BM-CAB-004 — Traçabilité Renforcée des Interventions Cabinet
- Toute action effectuée par un membre du cabinet sur le dossier d'un client est enregistrée dans le journal d'audit avec une double identité :
  - L'identifiant de l'utilisateur physique (ex: `user_expert_12`).
  - L'identifiant du cabinet mandataire (ex: `cabinet_abc`).
- L'entreprise cliente a une visibilité totale sur l'historique de toutes les interventions réalisées par son cabinet.

---

## 3. Scénarios BDD : Révocation immédiate d'un accès cabinet

```gherkin
Fonctionnalité : Révocation du Mandat Cabinet

Scénario : Blocage immédiat des requêtes après révocation
  Étant donné une liaison active entre "Société BATIPRO" et "Cabinet COMPTA-PLUS"
  Et un collaborateur du cabinet connecté au dossier de BATIPRO

  Quand l'administrateur de BATIPRO clique sur "Révoquer le cabinet"
  Alors le statut de la liaison devient "REVOKED"
  Et si le collaborateur du cabinet tente une opération suivante (ex: voir les factures)
  Alors le système renvoie une erreur 403 "CABINET_ACCESS_REVOKED"
  Et aucune donnée de BATIPRO ne lui est retournée
```

---

## 4. Dictionnaire des Erreurs Espace Cabinet

| Code d'erreur | Description |
|---|---|
| `CABINET_INVITE_CODE_EXPIRED` | Le code de liaison généré a expiré (dépassé 48h) |
| `CABINET_ACCESS_REVOKED` | L'accès à ce dossier client a été révoqué par l'entreprise |
| `UNAUTHORIZED_CABINET_MODULE` | Le client n'a pas délégué les permissions pour ce module |
| `DUPLICATE_CABINET_LINK` | Une liaison active existe déjà avec ce cabinet |
