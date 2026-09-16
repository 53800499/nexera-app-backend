# ADR-004 : Architecture du Moteur de Calcul de Paie OHADA / Bénin

## Statut
**Accepté**

## Contexte
Le calcul de la paie dans l'espace OHADA et particulièrement au Bénin obéit à des règles complexes d'enchevêtrement fiscal et social :
- Cotisations sociales ouvrières et patronales (Caisse Nationale de Sécurité Sociale - CNSS).
- Retenues fiscales progressives au titre de l'IPTS / IRPP avec abattements progressifs selon la charge familiale (enfants et conjoint).
- Cotisations patronales spécifiques (Versement Patronal sur Salaires - VPS).
- Écrêtements selon les plafonds légaux de sécurité sociale.

L'objectif était d'obtenir un moteur déterministe, traçable au centime près et auditable par les inspecteurs du travail.

## Décision
Nous avons isolé le moteur de calcul dans un service dédié `CalculPaieService` au sein de `src/modules/rh/paie/` :
1. **Pipeline de Calcul Séquentiel Fonctionnel** :
   - Étape 1 : Détermination de la base brute contractuelle et des indemnités imposables/non imposables.
   - Étape 2 : Calcul des cotisations CNSS ouvrières (3.6%) avec contrôle de plafond.
   - Étape 3 : Calcul du salaire net imposable ($Brut - CNSS_{Ouvrière}$).
   - Étape 4 : Application du barème progressif par tranches d'IPTS et déduction de l'abattement pour charges de famille.
   - Étape 5 : Calcul des charges patronales (CNSS 14.4% + VPS 4%).
   - Étape 6 : Détermination du net à payer et des acomptes à déduire.
2. **Immutabilité de Période Clôturée** :
   Une fois qu'une période de paie est validée par l'action `cloturer`, les enregistrements `payroll_slips` et `payroll_lines` sont verrouillés contre toute modification ultérieure.

## Conséquences
### Positives :
- Précision mathématique absolue vérifiée par des tests unitaires exhaustifs (`calcul-paie.service.spec.ts`).
- Conformité parfaite aux bulletins de paie légaux avec export PDF vectoriel via `BulletinsPdfService`.
### Négatives & Atténuations :
- Nécessite d'ajuster les constantes de barème si la loi de finances annuelle modifie les tranches de l'IPTS -> géré par un référentiel paramétrable en base de données (`tax_brackets_ipts`).
