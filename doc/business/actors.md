# 👥 Acteurs, Rôles et Responsabilités — NEXERA

Ce document identifie les personnes et systèmes qui interagissent avec Nexera, ainsi que la matrice de leurs responsabilités et périmètres d'action.

---

## 1. Typologie des Acteurs

```text
Acteurs
├── Acteurs Internes Entreprise
│   ├── Administrateur Entreprise (Tenant Admin)
│   ├── Commercial / Facturation
│   ├── Gestionnaire de Stock / Magasinier
│   ├── Responsable RH / Gestionnaire Paie
│   └── Employé (Collaborateur)
├── Acteurs Externes
│   ├── Collaborateur Cabinet Comptable
│   ├── Expert-Comptable Associé
│   └── Auditeur / Inspecteur Fiscal (Lecture Seule)
└── Systèmes Tiers
    ├── Système DGI / MECEF (Certification des factures)
    ├── Fournisseur SMTP / Emailing (Envoi factures & relances)
    └── Passerelle de Paiement (Mobile Money / Carte)
```

---

## 2. Matrice des Rôles et Responsabilités

| Rôle | Responsabilités Métier Principales | Périmètre de Données |
|---|---|---|
| **Super Admin Plateforme** | Maintenance globale, gestion des abonnements SaaS, support technique niveau 3. | Cross-tenants (technique uniquement, pas d'accès aux données métier sans consentement). |
| **Administrateur Entreprise** | Configuration de l'entreprise, gestion des utilisateurs, validation des politiques de dépenses, clôture d'exercice. | Son Tenant uniquement. |
| **Commercial / ADV** | Création de devis, conversion en commandes et factures, suivi des règlements et relances clients. | Devis, Factures, Clients, Catalogues de son Tenant. |
| **Gestionnaire de Stock** | Réception de marchandises, préparation des sorties, comptage d'inventaire, alertes de réapprovisionnement. | Entrepôts, Articles, Mouvements de stock de son Tenant. |
| **Responsable RH / Paie** | Gestion des dossiers salariés, validation des demandes de congés, préparation et clôture de la paie mensuelle. | Employés, Contrats, Congés, Bulletins de salaire. |
| **Employé** | Consultation de ses bulletins de paie, soumission de ses demandes de congés et notes de frais. | **Strictement ses propres données** personnelles. |
| **Collaborateur Cabinet** | Supervision comptable, réconciliation bancaire, préparation des déclarations fiscales, export FEC. | Tenants clients pour lesquels le cabinet a reçu un mandat. |

---

## 3. Règles d'Isolation et de Sécurité

### BM-SEC-001 — Isolation des données par Tenant
- Un utilisateur appartenant à l'Entreprise A ne peut en aucun cas lire, modifier ou supprimer les données de l'Entreprise B.
- Toute requête en base de données doit être filtrée par le `tenant_id` issu du token JWT authentifié.

### BM-SEC-002 — Cloisonnement Salarié / RH
- Un employé ne peut consulter que ses propres demandes d'absences, ses propres notes de frais et ses propres bulletins de paie.
- La consultation des salaires d'autres collaborateurs est strictement réservée au rôle `RH_MANAGER` et `TENANT_ADMIN`.

### BM-SEC-003 — Accès Cabinet Comptable
- Un cabinet comptable n'accède à une entreprise cliente que si un lien actif (`CabinetClientLink`) avec statut `ACTIVE` existe.
- L'entreprise cliente peut révoquer l'accès du cabinet à tout moment. Dès révocation, tout accès est immédiatement coupé.
