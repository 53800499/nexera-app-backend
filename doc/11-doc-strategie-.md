# Stratégie Technique & Roadmap — Backend Nexera ERP

---

## 1. Vision Stratégique à Long Terme

L'ambition technique de **Nexera ERP** est de s'imposer comme le progiciel de référence pour la gestion et la conformité d'entreprise dans l'espace **UEMOA** et **OHADA**. Le backend est conçu pour être un moteur robuste, évolutif et agnostique des particularismes nationaux tout en offrant des adaptateurs fiscaux ultras-spécialisés.

---

## 2. Piliers d'Évolution Stratégique

### Pilier 1 : Scalabilité Haute Disponibilité & Performance
- **Séparation Lecture / Écriture (Read Replicas)** : Introduction de réplicas de lecture PostgreSQL pour absorber les volumes massifs de consultations de rapports financiers et de tableaux de bord sans saturer l'instance primaire d'écriture.
- **Cache Distribué Redis** :
  - Mise en cache des référentiels statiques (taux de change, barèmes fiscaux, règles de numérotation).
  - Gestion des verrous distribués (*Redlock*) pour garantir l'unicité absolue de la numérotation séquentielle lors de pics d'émissions simultanées.

### Pilier 2 : Résilience & Architecture Hors-Ligne Renforcée (Offline-First)
Dans de nombreuses régions de l'Afrique de l'Ouest, la connectivité Internet peut subir des interruptions sporadiques :
- Évolution du module `sync` vers un protocole de synchronisation différentielle bidirectionnelle basé sur des *Conflict-Free Replicated Data Types (CRDT)*.
- Capacité pour les caisses et terminaux de vente de délivrer des reçus sécurisés hors-ligne et de différer la signature e-MECeF avec file d'attente de rejeu automatique dès rétablissement du réseau.

### Pilier 3 : Expansion Fiscale Sous-Régionale (UEMOA / CEMAC)
La modularité de Nexera permet de reproduire le succès de l'intégration **e-MECeF Bénin** sur les systèmes de facturation normalisée des pays voisins :
- **Côte d'Ivoire** : Intégration avec la Facture Normalisée Électronique (FNE) de la DGI ivoirienne.
- **Togo** : Raccordement au système de facturation certifiée de l'Office Togolais des Recettes (OTR).
- **Sénégal** : Prise en charge des exigences déclaratives de la DGID sénégalaise.

### Pilier 4 : Automatisation Intelligente & IA Embarquée
- **OCR Intelligent des Justificatifs de Dépenses** : Intégration d'un pipeline de vision par ordinateur extrayant automatiquement la date, le montant TTC, la TVA et le nom du fournisseur sur les photos de tickets de caisse soumises dans le module `notes-frais`.
- **Rapprochement Bancaire Prédictif** : Algorithme de réconciliation semi-automatique des lignes de relevés bancaires avec les factures ouvertes selon la similarité des montants et des libellés.

---

## 3. Feuille de Route Trimestrielle (Roadmap Technique)

```
        2026 Q3 (Actuel)                   2026 Q4                            2027 Q1-Q2
+-----------------------------+   +-----------------------------+   +-----------------------------+
| • Stabilisation v1.0        |   | • Cache distribué Redis     |   | • Extension Fiscale UEMOA   |
| • Certification e-MECeF     |   | • OCR Notes de frais IA     |   |   (Côte d'Ivoire / Togo)    |
| • Moteur Paie OHADA / CNSS  |   | • Rapprochement bancaire auto|   | • Passerelles bancaires API |
| • Export FEC Arrêté 1085-C  |   | • App mobile d'approbation  |   | • Read-Replicas PostgreSQL  |
+-----------------------------+   +-----------------------------+   +-----------------------------+
```

---

## 4. Souveraineté des Données & Conformité Réglementaire

Face aux exigences croissantes des régulateurs (Autorité de Protection des Données Personnelles - APDP au Bénin, conformité bancaire BCEAO) :
- Nexera privilégie une architecture compatible avec l'hébergement sur des infrastructures Cloud locales ou régionales sécurisées.
- Toutes les données financières, salariales et comptables font l'objet d'un chiffrement de repos (*Encryption at Rest*) et de transit (*TLS 1.3*).
- Les mécanismes de purge et d'archivage légal garantissent la conservation obligatoire des pièces justificatives pendant la durée légale de **10 ans** prescrite par le droit commercial OHADA.
