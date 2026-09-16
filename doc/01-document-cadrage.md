# Document de Cadrage — Backend Nexera ERP

---

## 1. Vision et Contexte du Produit

### 1.1 Vision
**Nexera ERP** est une suite logicielle intégrée de gestion commerciale, comptable, fiscale et des ressources humaines spécialement conçue pour les Très Petites, Petites et Moyennes Entreprises (TPME) ainsi que pour les Cabinets d'Expertise Comptable opérant dans la zone **OHADA** (Organisation pour l'Harmonisation en Afrique du Droit des Affaires) et plus particulièrement en **République du Bénin**.

L'ambition première de Nexera est de simplifier et fiabiliser la gestion quotidienne des entreprises tout en assurant une conformité réglementaire totale, immédiate et automatisée avec :
1. Le système de facturation électronique normalisée de la Direction Générale des Impôts du Bénin (**e-MECeF DGI**).
2. Les normes de contrôle fiscal dématérialisé fixées par l'**Arrêté 1085-C** portant modalités de présentation du Fichier des Écritures Comptables (**FEC**).
3. Le référentiel comptable révisé du Système Comptable OHADA (**SYSCOHADA révisé**).
4. La législation sociale et le Code du Travail béninois (cotisations **CNSS**, impôt sur le revenu salarial **IPTS/IRPP**, Versement Patronal sur Salaires **VPS**).

### 1.2 Le Problème Métier Résolu
Historiquement, les entreprises de la sous-région se heurtent à une triple complexité :
- **Rupture de chaîne entre la vente et la fiscalité** : Obligation d'utiliser des machines physiques MECeF encombrantes ou des doubles saisies génératrices d'erreurs et de pénalités fiscales.
- **Dispersion des outils** : Facturation sur un tableur, gestion de la paie sur un autre logiciel non interconnecté, et comptabilité tenue en fin d'exercice sur un progiciel tiers sans visibilité en temps réel.
- **Absence de collaboration fluide avec l'Expert-Comptable** : Échange tardif de classeurs papier ou d'exports désynchronisés entraînant des retards dans les déclarations fiscales et sociales mensuelles.

Nexera résout ce défi par une plateforme unifiée, temps réel, multi-locataires (*multi-tenant*) et collaborative.

---

## 2. Objectifs Stratégiques du Backend

Le backend constitue le cœur applicatif de Nexera. Ses objectifs cardinaux sont :

1. **Intégrité et Sécurité Fiscale Absolue** :
   - Garantir qu'aucune facture commerciale émise ne puisse échapper à son cycle de normalisation réglementaire.
   - Assurer l'inaltérabilité des séquences comptables et des pistes d'audit (*Audit Trail* horodaté et inviolable).
2. **Isolation Étanche Multi-Locataires (Multi-Tenancy)** :
   - Cloisonner rigoureusement les données de chaque entreprise cliente grâce à la technologie PostgreSQL **Row Level Security (RLS)** directement appliquée au niveau du moteur de base de données.
3. **Interopérabilité Réactive** :
   - Communiquer de manière transparente avec les serveurs de la DGI Bénin (e-MECeF) via API REST sécurisée ou basculer dynamiquement en mode simulation sandbox contrôlé en environnement de développement et d'homologation.
4. **Performance et Disponibilité** :
   - Assurer des temps de réponse moyens inférieurs à 150 ms sur les transactions opérationnelles critiques.
   - Supporter le mode déconnecté / synchronisation différée (*Offline Sync*) pour les points de vente opérant en environnement réseau instable.

---

## 3. Périmètre Fonctionnel Global

### 3.1 Périmètre Inclus (In-Scope)

```
+-----------------------------------------------------------------------------+
|                               NEXERA ERP BACKEND                            |
+-----------------------------------------------------------------------------+
|  [M1] Authentification & RBAC     | [M2] CRM & Annuaire Tiers               |
|  [M3] Catalogue & Grilles Tarif   | [M4] Devis, Commandes & Bons Livraison  |
|  [M5] Facturation Standard & Avoir| [M6] e-MECeF (Certification DGI Bénin)  |
|  [M7] Encaissements & Règlements  | [M8] Relances Clients Intelligentes     |
|  [M9] Gestion des Stocks & PMP    | [M10] RH, Contrats & Absences           |
|  [M11] Moteur de Paie OHADA       | [M12] Notes de Frais & Avances Mission  |
|  [M13] Fiscalité (TVA, AIB, TVM)  | [M14] Export FEC (Arrêté 1085-C)        |
|  [M15] Espace Cabinet Comptable   | [M16] Audit Trail & Métriques           |
|  [M17] Moteur PDF & QR Code       | [M18] Synchronisation Hors-Ligne        |
+-----------------------------------------------------------------------------+
```

### 3.2 Périmètre Exclu (Out-of-Scope pour la version actuelle)
- Connexion directe par passerelle bancaire EBICS / SWIFT (les rapprochements sont gérés par imports de relevés et lettrage manuel/automatisé).
- Gestion complète de la production industrielle lourde (GPAO complexe avec nomenclatures à niveaux multiples infinis).
- Télétransmissions automatisées directes aux banques centrales (BCEAO).

---

## 4. Typologie des Utilisateurs et Personas

| Persona | Rôle & Profil | Attentes Principales envers le Backend |
| :--- | :--- | :--- |
| **Directeur Général / Gérant de PME** | Décideur non-comptable | Dashboard consolidé de rentabilité, trésorerie temps réel, zéro risque fiscal. |
| **Responsable Commercial** | Utilisateur opérationnel intensif | Émission rapide de devis/commandes, conversion en 1 clic en facture, suivi des règlements. |
| **Comptable Interne / DAF** | Gestionnaire financier | Lettrage précis, ventilation par taux de TVA, conformité e-MECeF, préparation de la liasse. |
| **Gestionnaire de Paie / DRH** | Administrateur du personnel | Calcul sans faille des salaires, déduction exacte des acomptes, génération des fiches de paie. |
| **Collaborateur / Salarié** | Utilisateur occasionnel | Saisie simplifiée des notes de frais, téléversement de justificatifs, consultation de fiches de paie. |
| **Expert-Comptable Externe** | Superviseur multi-dossiers | Accès transversal au portefeuille, révision comptable, validation et export FEC scellé. |
| **Auditeur / Inspecteur Fiscal** | Rôle de contrôle | Contrôle de la piste d'audit, validation cryptographique des QR Codes e-MECeF, cohérence du FEC. |

---

## 5. Matrice de Gouvernance des Rôles & Accès

Le backend repose sur un modèle d'autorisations RBAC (*Role-Based Access Control*) granulaire appliqué par des permissions unifiées :

- `SuperAdmin` : Gestion globale de la plateforme, gestion des souscriptions tenants.
- `TenantAdmin` : Administrateur de l'espace entreprise, paramétrage fiscal, gestion des utilisateurs internes.
- `Commercial` : Création et gestion des tiers, devis, commandes, factures de vente.
- `Comptable` : Validation des factures, imputations des paiements, déclarations fiscales, export FEC.
- `GestionnaireRH` : Gestion des employés, contrats, barèmes sociaux, calcul et clôture de paie.
- `Manager` : Validation hiérarchique des notes de frais et des congés de son équipe.
- `Employe` : Dépôt de notes de frais personnelles, consultation de ses propres bulletins.
- `CabinetSuperviseur` : Accès en lecture/écriture spécialisée aux dossiers de clients rattachés.

---

## 6. Facteurs Clés de Succès (KPIs Métiers)

1. **Taux de Succès e-MECeF** : > 99.8% de factures certifiées sans rejet lors de l'émission.
2. **Temps de Génération PDF** : < 600 ms pour une facture complexe comprenant 50 lignes, mentions légales, tableau de ventilation et QR code haute résolution.
3. **Exactitude du Calcul de Paie** : Zéro écart au centime près entre les décomptes bruts/nets, les tranches IPTS progressives et les déclarations CNSS.
4. **Conformité FEC** : 100% de validation aux tests de conformité DGI sur la structure du fichier dématérialisé (Arrêté 1085-C).
