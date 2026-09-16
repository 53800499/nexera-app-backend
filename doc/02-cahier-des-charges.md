# Cahier des Charges — Backend Nexera ERP

---

## 1. Introduction & Objectif du Document
Le présent document formalise l'ensemble des exigences fonctionnelles, techniques, organisationnelles et réglementaires qui encadrent la conception, le développement et le maintien en condition opérationnelle du backend de **Nexera ERP**.

---

## 2. Exigences Fonctionnelles Détaillées (EF)

### EF-01 : Gestion Multi-Locataires (Multi-Tenancy)
- **EF-01.1** : Le système doit isoler de manière stricte et étanche les données de chaque entreprise cliente (*Tenant*).
- **EF-01.2** : Un utilisateur peut appartenir à un ou plusieurs tenants (notamment dans le cas des collaborateurs de cabinets comptables), avec des contextes de session distincts et traçables.
- **EF-01.3** : Chaque tenant dispose de ses propres référentiels (devises, taux de taxe, règles de numérotation séquentielle, modèles PDF/Email, paramètres e-MECeF).

### EF-02 : Cycle Commercial (Devis, Commandes, Factures)
- **EF-02.1** : Le système doit permettre la création de devis avec calcul instantané des totaux HT, remises (taux ou montant), bases taxables par taux, TVA et TTC.
- **EF-02.2** : Tout devis accepté doit pouvoir être converti en un clic en commande client ou directement en facture sans ressaisie d'information.
- **EF-02.3** : Le moteur de numérotation séquentielle doit garantir l'absence absolue de rupture ou de doublon dans les numéros de documents émis (format paramétrable par préfixe, année, mois et compteur séquentiel à zéros complétés).
- **EF-02.4** : Une facture au statut `issued` (émise) devient non modifiable. Toute correction doit obligatoirement transiter par l'émission d'une facture d'avoir (*Credit Note*).

### EF-03 : Normalisation Fiscale e-MECeF (DGI Bénin)
- **EF-03.1** : Toute facture émise doit pouvoir faire l'objet d'une normalisation fiscale soit automatiquement lors de l'émission (`mecefAutoNormalize: true`), soit sur action explicite d'un utilisateur habilité.
- **EF-03.2** : L'intégration e-MECeF doit ventiler rigoureusement les lignes de facture selon les groupes de taxation officiels DGI :
  - Groupe A : Exonéré (0%)
  - Groupe B : Taxable normal (18%)
  - Groupe C : Exportations (0%)
  - Groupe D : Régime d'exception (0%)
  - Groupe E : Régime fiscal synthétique (TPS)
  - Groupe F : Réservé
- **EF-03.3** : Le système doit calculer l'Acompte sur Impôt Assis sur les Bénéfices (AIB) applicable :
  - Type A : 1% sur la base HT pour les clients immatriculés (IFU renseigné).
  - Type B : 5% sur la base HT pour les clients non immatriculés ou prestataires sans IFU.
  - NONE : Aucun AIB.
- **EF-03.4** : Le système doit intégrer sur le PDF de la facture :
  - Le Numéro d'Identification de la Machine (NIM).
  - Les compteurs séquentiels MC (Machine Counter) et TC (Total Counter) avec le type officiel (`FV` pour vente, `FA` pour avoir).
  - Le Code de sécurité cryptographique MECeF (format `BJ01-XXXX-XXXX-XXXX-XXXX`).
  - Le QR Code haute définition encodant l'URL officielle de vérification DGI (`https://mecef.impots.bj/verify/{NIM}/{codeMECeF}`).
- **EF-03.5** : Pour les avoirs (`credit_note` / type `FA`), le système doit obligatoirement exiger et transmettre le code MECeF de la facture de vente d'origine.
- **EF-03.6** : En mode hors production ou en absence d'accès direct à l'API DGI, le backend doit fournir une simulation cryptographique déterministe garantissant le bon déroulement des tests sans impact fiscal réel.

### EF-04 : Règlements, Encaissements & Trésorerie
- **EF-04.1** : Enregistrement des encaissements multi-modes (Virement bancaire, Chèque, Espèces, Mobile Money).
- **EF-04.2** : Imputation flexible des paiements : totale, partielle sur plusieurs factures ou génération d'un acompte en attente d'imputation.
- **EF-04.3** : Calcul et application paramétrable des pénalités de retard selon le taux légal défini par le tenant.

### EF-05 : Gestion des Ressources Humaines & Moteur de Paie OHADA
- **EF-05.1** : Gestion du dossier collaborateur (état civil, matricule, contrat, date d'embauche, personnes à charge pour le calcul du quotient familial fiscal).
- **EF-05.2** : Moteur de calcul de paie mensuel conforme au Code du Travail et à la législation sociale béninoise :
  - Salaire brut de base, sursalaires, primes imposables et non-imposables.
  - Cotisations sociales salariales et patronales CNSS (Caisse Nationale de Sécurité Sociale : vieillesse, prestations familiales, accidents de travail).
  - Retenues fiscales salariales : barème progressif de l'IPTS (Impôt Progressif sur les Traitements et Salaires) ou IRPP avec abattements pour charges de famille.
  - Cotisation patronale Versement Patronal sur Salaires (VPS).
- **EF-05.3** : Génération automatisée des fiches de paie conformes en PDF vectoriel et clôture de période avec verrouillage des écritures.

### EF-06 : Gestion des Notes de Frais & Avances
- **EF-06.1** : Déclaration de dépenses avec saisie de la date, du montant, de la devise, de la catégorie et téléversement de la pièce justificative numérisée.
- **EF-06.2** : Circuit d'approbation hiérarchique à double niveau (Validation Manager -> Approbation Comptable).
- **EF-06.3** : Gestion des avances sur mission et calcul automatique du solde à rembourser ou à reverser.

### EF-07 : Fiscalité Déclarative & Fichier des Écritures Comptables (FEC)
- **EF-07.1** : Suivi automatisé et pré-remplissage des états périodiques de TVA (TVA facturée/collectée, TVA déductible sur biens et services, crédit de TVA).
- **EF-07.2** : Génération et exportation du Fichier des Écritures Comptables (FEC) strictement conforme à l'**Arrêté 1085-C** du Ministère des Finances du Bénin :
  - Format texte délimité par tabulation ou point-virgule avec encodage UTF-8.
  - Respect scrupuleux des 18 champs normalisés (Code journal, Libellé journal, Numéro sur séquence, Date comptabilisation, Numéro de compte, Intitulé compte, Référence pièce, Date pièce, Débit, Crédit, Lettrage, etc.).
  - Scellement cryptographique par empreinte SHA-256 garantissant l'intégrité du fichier transmis aux inspecteurs des impôts.

### EF-08 : Espace Cabinet d'Expertise Comptable
- **EF-08.1** : Tableau de bord multi-dossiers permettant aux experts-comptables et commissaires aux comptes de superviser l'état comptable de plusieurs tenants clients.
- **EF-08.2** : Outils de révision, pointage, cadrage de TVA et validation des clôtures de période.

---

## 3. Exigences Non-Fonctionnelles (ENF)

### ENF-01 : Sécurité & Confidentialité
- **ENF-01.1** : Authentification stateless basée sur **JSON Web Tokens (JWT)** signés en HMAC SHA-256 avec durée de vie courte pour l'Access Token (15 minutes) et stockage sécurisé des Refresh Tokens (7 jours).
- **ENF-01.2** : Tous les mots de passe utilisateurs doivent être hachés à l'aide de l'algorithme **Bcrypt** avec un facteur de coût (*salt rounds*) supérieur ou égal à 10.
- **ENF-01.3** : Contrôle strict des autorisations par **Role-Based Access Control (RBAC)** via des décorateurs et guards NestJS appliqués à 100% des endpoints non publics.
- **ENF-01.4** : Protection contre les attaques courantes (CORS restrictif paramétrable par environnement, validation et assainissement strict des DTOs avec `whitelist: true` et `forbidNonWhitelisted: true`).

### ENF-02 : Performance & Évolutivité
- **ENF-02.1** : Temps de réponse API p95 < 200 ms pour les requêtes de lecture et p95 < 400 ms pour les transactions d'écriture complexes.
- **ENF-02.2** : Architecture sans état (*stateless*) permettant une mise à l'échelle horizontale (*horizontal scaling*) immédiate derrière un reverse proxy / load balancer.
- **ENF-02.3** : Optimisation des requêtes SQL via index composites sur les colonnes fréquemment filtrées (`tenant_id`, `issue_date`, `status`, `number`).

### ENF-03 : Disponibilité & Fiabilité
- **ENF-03.1** : Objectif de disponibilité du service de 99.9% hors fenêtres de maintenance planifiées.
- **ENF-03.2** : Isolation transactionnelle PostgreSQL (`prisma.$transaction`) sur toutes les opérations multi-tables sensibles (émission de facture + mise à jour des stocks + écriture d'audit).
- **ENF-03.3** : Endpoints de sondage d'état (*Health Checks*) conformes aux exigences Kubernetes / Render (`/health`, `/health/liveness`, `/health/readiness`).

### ENF-04 : Auditabilité & Traçabilité
- **ENF-04.1** : Tout événement modifiant l'état financier ou organisationnel d'un tenant doit générer un enregistrement inaltérable dans la table `audit_logs`.
- **ENF-04.2** : Les logs d'audit doivent capturer l'identifiant du tenant, de l'utilisateur, l'adresse IP, le type d'entité, l'action réalisée et le différentiel (*diff* JSON) avant/après modification.

---

## 4. Cadre Réglementaire et Légal de Référence

| Texte / Norme | Autorité de Régulation | Impact Direct sur le Backend Nexera |
| :--- | :--- | :--- |
| **Système e-MECeF** | Direction Générale des Impôts (Bénin) | Format de certification de facture, attribution du code MECeF et du QR Code, télétransmission API. |
| **Arrêté 1085-C** | Ministère de l'Économie et des Finances (Bénin) | Structure rigoureuse du Fichier des Écritures Comptables (FEC), ordre des 18 colonnes, équilibre Débit/Crédit. |
| **Code Général des Impôts (CGI)** | République du Bénin | Taux légal de TVA (18%), régimes d'exonération, assiettes et retenues d'AIB (1% et 5%). |
| **Acte Uniforme SYSCOHADA** | Conseil des Ministres de l'OHADA | Nomenclature du plan comptable général, règles d'évaluation et de présentation des états financiers. |
| **Code du Travail & Régime CNSS** | Ministère du Travail / CNSS Bénin | Plafonds de cotisations sociales, tranches d'imposition IPTS/IRPP, charges patronales et mentions obligatoires du bulletin. |
| **Loi sur la Protection des Données Personnelles** | APDP (Bénin) | Confidentialité des données salariés et clients, consentement et droit à l'effacement. |

---

## 5. Matrice de Traçabilité des Exigences

```
[Exigence Fonctionnelle]  --> [Composant Backend]           --> [Garantie / Vérification]
EF-01 (Multi-Tenancy)     --> TenantRlsInterceptor / DB RLS --> Test d'étanchéité inter-tenant
EF-02 (Ventes / Devis)    --> Quotations / Invoices Module  --> Séquentialité stricte sans trou
EF-03 (e-MECeF DGI)       --> MecefClientService            --> Signature API DGI ou simulation cryptographique
EF-04 (Règlements)        --> PaymentsModule / Imputations  --> Équilibre montants dus / encaissés
EF-05 (Paie OHADA)        --> CalculPaieService             --> Conformité barème IPTS / CNSS
EF-06 (Notes de frais)    --> NotesFraisModule              --> Double validation Manager/Compta
EF-07 (Fiscalité / FEC)   --> FecExportService              --> Validation conformité Arrêté 1085-C
ENF-01 (Sécurité)         --> JwtAuthGuard / Permissions    --> Audit OWASP & tests automatisés
ENF-04 (Auditabilité)     --> AuditService                  --> Immuabilité des traces d'audit
```
