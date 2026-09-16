# ADR-005 : Conformité du Fichier des Écritures Comptables (Arrêté 1085-C)

## Statut
**Accepté**

## Contexte
L'Arrêté ministériel 1085-C du Ministère de l'Économie et des Finances de la République du Bénin fixe des obligations très strictes de dématérialisation et de contrôle fiscal :
- Toute entreprise tenant sa comptabilité au moyen de systèmes informatisés doit être en mesure de produire le Fichier des Écritures Comptables (FEC).
- Le fichier doit obéir à un ordre strict de 18 colonnes normées et équilibrées ($\sum Débit = \sum Crédit$).
- Tout rejet ou anomalie de structure lors d'un contrôle fiscal expose l'entreprise au rejet de sa comptabilité et à des pénalités sévères.

## Décision
Nous avons développé un module d'exportation et d'audit préalable `FecExportService` au sein de `src/modules/fiscalite/fec/` :
1. **Diagnostic Pré-Export** :
   Une route de contrôle `/api/fiscalite/fec/controle` vérifie en amont :
   - L'équilibre débit/crédit de chaque écriture comptable.
   - La présence des références obligatoires de pièces justificatives.
   - L'absence de ruptures dans les séquences de dates et de numérotation.
2. **Génération Tabulée Conforme** :
   Le fichier est généré au format texte délimité par tabulation (`\t`), sans espace superflue, encodé en UTF-8 sans BOM.
3. **Scellement Cryptographique SHA-256** :
   Chaque génération de fichier FEC calcule l'empreinte de hachage SHA-256 du fichier produit et l'enregistre dans la table d'audit `fec_exports`. Cette empreinte sert de preuve d'antériorité et d'intégrité devant les vérificateurs des impôts.

## Conséquences
### Positives :
- Sérénité totale pour les entreprises clientes et les experts-comptables lors des contrôles fiscaux dématérialisés.
- Diagnostic en amont permettant de corriger les anomalies avant transmission à l'administration.
- Valorisation de la solution Nexera comme progiciel officiellement conforme aux textes de la DGI Bénin.
### Négatives & Atténuations :
- L'export sur des entreprises à très fort volume (millions d'écritures) peut consommer de la mémoire -> traité par streaming de lignes (`fs.createWriteStream` / flux Prisma paginé).
