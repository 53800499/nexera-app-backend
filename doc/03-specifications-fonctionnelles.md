# Spécifications Fonctionnelles Détaillées (SFD) — Backend Nexera ERP

---

## 1. Introduction
Ce document détaille les spécifications fonctionnelles de l'ensemble des modules composant le backend de **Nexera ERP**. Chaque module y est décrit avec ses règles de gestion, ses modèles de données associés, ses flux de traitement et ses contraintes d'intégrité.

---

## 2. Cartographie des 23 Modules Backend

```
+----------------------------------------------------------------------------------------+
|                                    NEXERA BACKEND                                      |
+----------------------------------------------------------------------------------------+
| SOCLE TECHNIQUE & SÉCURITÉ :                                                           |
|  [01] auth           [02] roles          [03] permissions    [04] tenants              |
|  [05] users          [06] settings       [07] audit          [08] sync                 |
+----------------------------------------------------------------------------------------+
| GESTION COMMERCIALE & FACTURATION :                                                    |
|  [09] clients (CRM)  [10] catalogue      [11] quotations     [12] orders               |
|  [13] invoices       [14] mecef (DGI)    [15] payments       [16] reminders            |
|  [17] stock                                                                            |
+----------------------------------------------------------------------------------------+
| RESSOURCES HUMAINES & FRAIS :                                                          |
|  [18] rh (Gestion RH)                    [19] rh/paie (Moteur de Paie OHADA)           |
|  [20] notes-frais (Dépenses & Avances)                                                 |
+----------------------------------------------------------------------------------------+
| EXPERTISE COMPTABLE & FISCALITÉ :                                                      |
|  [21] fiscalite (TVA, AIB, FEC)          [22] cabinet (Portefeuille & Supervision)     |
|  [23] dashboard / exports / documents                                                  |
+----------------------------------------------------------------------------------------+
```

---

## 3. Détail des Spécifications par Module

### 3.1 Module 01 : Authentification & Sessions (`auth`)
- **Inscription & Onboarding** : Création simultanée du compte utilisateur administrateur et de son organisation tenant par défaut.
- **Connexion Sécurisée** : Vérification des identifiants (Email + Mot de passe haché par Bcrypt). Émission d'une paire de jetons :
  - `accessToken` : JWT signé (15 minutes de validité), contenant `sub` (userId), `email`, `tenantId`, `role` et la liste des `permissions`.
  - `refreshToken` : Stocké en base de données de manière hachée, à usage unique (rotation de refresh token à chaque renouvellement) avec expiration à 7 jours.
- **Gestion des Sessions & Multi-Tenant** : Possibilité pour un utilisateur appartenant à plusieurs organisations de basculer de contexte tenant sans se reconnecter.
- **Réinitialisation de Mot de Passe** : Génération de token cryptographique sécurisé à durée de vie limitée (60 min) expédié par email transactionnel.

### 3.2 Modules 02 & 03 : Rôles & Permissions (`roles`, `permissions`)
- **Granularité RBAC** : Les accès aux endpoints sont contrôlés par la permission exacte requise (ex. `invoices.read`, `invoices.create`, `invoices.normalize`, `payroll.calculate`, `fec.export`).
- **Rôles Standards & Personnalisés** : Chaque tenant peut créer des rôles personnalisés en sélectionnant la liste des permissions associées.
- **Imperméabilité des Rôles Système** : Les rôles prédéfinis (`TenantAdmin`, `SuperAdmin`) sont protégés contre toute modification destructive.

### 3.3 Module 04 : Tenants & Organisations (`tenants`)
- **Structure de l'Organisation** : Raison sociale, forme juridique, numéro IFU, numéro RCCM, adresse du siège, devise par défaut (XOF, EUR, USD), exercice fiscal actif.
- **Cycle de Vie du Tenant** : Statuts `active`, `suspended`, `archived`. La suspension d'un tenant bloque immédiatement toute requête de ses utilisateurs.

### 3.4 Module 05 : Utilisateurs & Collaborateurs (`users`)
- **Profil Utilisateur** : Identité, email professionnel, matricule interne, téléphone, avatar, langue préférée.
- **Invitation de Collaborateurs** : Envoi d'invitations avec lien d'activation sécurisé et assignation directe d'un rôle.

### 3.5 Module 06 : Paramètres de l'Entreprise (`settings`)
- **Numérotation Séquentielle** : Modèles de numérotation pour devis, commandes, factures et avoirs. Variables supportées : `{PREFIX}-{YYYY}{MM}-{SEQ:4}`.
- **Devises & Taux de Change** : Gestion de la devise de tenue de compte et des devises de facturation avec saisie de taux manuels ou synchronisés.
- **Conditions de Règlement & Pénalités** : Délais standards (comptant, 30 jours, fin de mois) et mentions obligatoires des pénalités de retard.
- **Modèles de Documents** : Personnalisation graphique des PDF (couleurs primaires/secondaires, logo d'entreprise, coordonnées de bas de page).

### 3.6 Module 07 : Piste d'Audit (`audit`)
- **Traçabilité Inaltérable** : Enregistrement de chaque action critique (`CREATE`, `UPDATE`, `DELETE`, `NORMALIZE`, `CALCULATE_PAYROLL`).
- **Détail de l'Enregistrement** : Horodatage précis à la milliseconde, `tenantId`, `userId`, `ipAddress`, type d'entité, identifiant d'entité et capture du delta JSON (*diff* des champs modifiés).

### 3.7 Module 08 : Synchronisation Hors-Ligne (`sync`)
- **Fonctionnement Déconnecté** : Gestion d'un cache local côté client pour la saisie continue des ventes en l'absence de réseau Internet.
- **File d'Attente de Synchronisation** : Réception des lots d'opérations hors-ligne, résolution déterministe des conflits par horodatage logique (Vector Clocks / Lamport) et application séquentielle idempotente.

### 3.8 Module 09 : CRM & Tiers (`clients`)
- **Fiche Client & Prospect** : Raison sociale, enseigne commerciale, adresse de facturation et de livraison, contact principal et secondaires.
- **Identification Fiscale** : Enregistrement obligatoire de l'IFU (`taxId`) pour les clients personnes morales afin de débloquer le régime d'AIB 1% en facturation.
- **Plafonds d'Encours & Solde Temps Réel** : Suivi du chiffre d'affaires cumulé, des factures en attente de règlement et de l'encours maximal accordé.

### 3.9 Module 10 : Catalogue d'Articles & Services (`catalogue`)
- **Articles & Prestations** : Référence article (SKU), libellé, description détaillée, unité de mesure (unité, heure, forfait, kg, litre).
- **Tarification & Fiscalité** : Prix d'achat, prix de vente unitaire HT, taux de taxe par défaut et groupe de taxation e-MECeF rattaché (A, B, C, D, E).
- **Suivi de Gestion de Stock** : Indicateur activant ou désactivant la tenue de stock pour l'article.

### 3.10 Module 11 : Devis Commerciaux (`quotations`)
- **Création & Chiffrage** : Lignes d'articles avec prix unitaire, quantité, remises par ligne ou globale, calcul automatique de la TVA par taux.
- **Cycle de Vie du Devis** : `draft` -> `sent` -> `accepted` (ou `rejected` / `expired`).
- **Conversion en 1 Clic** : Génération immédiate d'une commande (`Order`) ou d'une facture (`Invoice`) avec conservation de la traçabilité du devis source.
- **Envoi par Email** : Génération du devis PDF avec filigrane et expédition au client via SMTP avec suivi de la date d'envoi.

### 3.11 Module 12 : Commandes Clients (`orders`)
- **Gestion des Bons de Commande** : Suivi des engagements clients fermes. Statuts `draft`, `confirmed`, `processing`, `delivered`, `cancelled`.
- **Génération de Bon de Livraison (BL)** : Émission de documents d'expédition avec décrémentation optionnelle des stocks lors de la livraison.

### 3.12 Module 13 : Facturation Standard & d'Avoir (`invoices`)
- **Typologie des Factures** : Facture de vente (`standard`), Facture d'acompte (`deposit`), Facture d'avoir (`credit_note`), Facture proforma (`proforma`).
- **Séquence Numérique Continue** : Attribution d'un numéro définitif lors du passage au statut `issued`. Immuabilité totale des données financières après émission.
- **Factures d'Avoir** : Référence obligatoire à la facture d'origine (`originalInvoiceId`). L'avoir annule tout ou partie de la créance et réajuste la TVA.
- **Facturation Récurrente** : Définition d'échéanciers (abonnements mensuels, trimestriels) générant automatiquement les factures à terme échu ou d'avance.

### 3.13 Module 14 : Certification Fiscale e-MECeF DGI Bénin (`mecef`)
- **Normalisation Fiscale Obligatoire** :
  - Contrôle préalable : la facture doit être au statut `issued` et ne pas être une proforma.
  - Calcul de la ventilation par groupe de taxe (A, B, C, D, E).
  - Détermination de l'AIB (1% avec IFU valide, 5% sans IFU, NONE si exonéré).
- **Mode Production API DGI** :
  - Appel HTTP sécurisé `POST /invoice` vers le serveur e-MECeF DGI avec payload conforme.
  - Réception et enregistrement du Code MECeF officiel, des compteurs séquentiels (ex. `12/150 FV`) et de la date fiscale certifiée.
  - Invalidation et régénération du PDF avec le QR Code officiel DGI (`https://mecef.impots.bj/verify/{nim}/{codeMECeF}`).
- **Mode Simulation Sandbox Déterministe** :
  - Hachage cryptographique SHA-256 local simulant fidèlement la signature DGI en l'absence de clés de production.
- **Avoirs Certifiés (Type FA)** :
  - Contrôle et transmission du code MECeF d'origine de la facture rectifiée.

### 3.14 Module 15 : Encaissements & Règlements (`payments`)
- **Enregistrement des Paiements** : Date de valeur, mode de règlement, compte bancaire ou caisse de destination, référence de transaction (chèque, bordereau de virement).
- **Imputations Multi-Factures** : Affectation d'un montant sur une ou plusieurs factures ouvertes avec mise à jour en temps réel des montants réglés (`amountPaid`) et des soldes restant dus (`amountDue`).
- **Gestion des Acomptes** : Encaissement préalable d'un acompte et imputation ultérieure sur la facture définitive émise.

### 3.15 Module 16 : Relances Clients (`reminders`)
- **Plans de Relance Multi-Niveaux** : Niveaux 1 (Courtoise), 2 (Ferme), 3 (Mise en demeure).
- **Exécution Planifiée (Cron)** : Détection automatique quotidienne des factures échues impayées et génération de relances selon les règles de délais définies.
- **Historique de Recouvrement** : Journal exhaustif des relances envoyées avec copies des messages.

### 3.16 Module 17 : Gestion des Stocks (`stock`)
- **Mouvements de Stock** : Entrées (réceptions fournisseurs), Sorties (livraisons clients), Ajustements d'inventaire, Transferts d'entrepôt.
- **Méthode de Valorisation** : Calcul en temps réel du Prix Moyen Pondéré (PMP) et suivi par méthode FIFO.
- **Alertes de Rupture** : Détection des stocks inférieurs au stock minimum de sécurité avec notification aux gestionnaires.

### 3.17 & 3.18 Modules 18 & 19 : Ressources Humaines & Paie OHADA (`rh`, `rh/paie`)
- **Gestion du Personnel** : Fiche salarié complète, contrat de travail (CDI, CDD, Stage), classification professionnelle selon convention collective.
- **Gestion des Temps & Absences** : Saisie des congés payés, arrêts maladie, absences justifiées/injustifiées avec impact automatique sur les jours travaillés.
- **Moteur de Calcul de Paie Salariale Bénin / OHADA** :
  - Salaire brut de base contractuel.
  - Primes et indemnités (transport, logement, fonction, ancienneté).
  - Cotisations CNSS Ouvrières (3.6% pension vieillesse).
  - Cotisations CNSS Patronales (Prestations familiales 9%, Accidents du travail 1% à 4%, Pension 6.4%).
  - Assiette fiscale et barème progressif de l'IPTS / IRPP avec abattements forfaitaires pour charges de famille (enfants à charge).
  - Versement Patronal sur Salaires (VPS : 4% de la masse salariale brute).
- **Bulletin de Paie Vectoriel** : Génération du bulletin conforme au modèle officiel OHADA et journal de paie récapitulatif.

### 3.19 Module 20 : Notes de Frais & Avances (`notes-frais`)
- **Saisie des Frais Professionnels** : Indemnités kilométriques selon barème fiscal, hébergement, restauration, transport.
- **Justificatifs Numérisés** : Téléversement et rattachement des reçus scannés aux lignes de frais.
- **Workflows d'Approbation** : Soumission -> Validation hiérarchique Manager -> Contrôle et ordonnancement Comptable -> Remboursement effectif.
- **Missions & Avances** : Demande d'avance financière préalable à une mission, décompte final à la rentrée et régularisation du reliquat.

### 3.20 Module 21 : Fiscalité Déclarative & Fichier FEC (`fiscalite`)
- **Déclarations Périodiques de TVA** : État récapitulatif mensuel de la TVA collectée sur ventes, de la TVA déductible sur achats et du calcul du crédit ou du solde de TVA à reverser.
- **Gestion de l'AIB (Acompte sur Impôt assis sur les Bénéfices)** : Registre des AIB perçus sur clients et des AIB retenus par les clients sur paiements.
- **Taxe sur les Véhicules à Moteur (TVM)** : Suivi du parc automobile de l'entreprise et des échéances de TVM.
- **Génération du Fichier des Écritures Comptables (FEC) — Arrêté 1085-C** :
  - Extraction de l'ensemble des écritures comptables du grand livre sur l'exercice.
  - Mise en forme stricte selon les 18 colonnes normées par la DGI.
  - Contrôle d'équilibre parfait : $\sum Débit = \sum Crédit$.
  - Calcul de l'empreinte de hachage de scellement SHA-256 garantissant l'intégrité du fichier pour l'administration fiscale.

### 3.21 Module 22 : Espace Cabinet d'Expertise Comptable (`cabinet`)
- **Portefeuille Multi-Clients** : Supervision centralisée de plusieurs dossiers d'entreprises clientes par les experts et collaborateurs de cabinet.
- **Outils de Révision & Pointage** : Validation des balances comptables, lettrage des comptes généraux et auxiliaires, émission de mémos d'audit.
- **Contrats & Lettres de Mission** : Suivi des conventions d'honoraires et des lettres de mission comptables.

### 3.22 Module 23 : Tableaux de Bord & Indicateurs de Pilotage (`dashboard`)
- **KPIs Financiers Clés** : Chiffre d'affaires facturé HT/TTC, encaissements du mois, montant des créances échues et délais moyens de paiement (DSO - Days Sales Outstanding).
- **Trésorerie Prévisionnelle** : Modélisation des flux entrants attendus selon les dates d'échéance des factures émises.
