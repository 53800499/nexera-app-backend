# 🌴 04 — Ressources Humaines & Moteur de Calcul de Paie

Ce document détaille la logique métier et les calculs du module `rh`.

---

## 1. Gestion des Congés & Détection de Chevauchement

### A. Règle de Non-Chevauchement des Absences
Avant d'enregistrer une demande d'absence, le service vérifie l'absence de conflit temporel :
```typescript
const conflit = await this.prisma.rhAbsence.findFirst({
  where: {
    employeId,
    statut: { notIn: ['REFUSE', 'ANNULE'] },
    AND: [
      { dateDebut: { lte: dateFin } },
      { dateFin: { gte: dateDebut } }
    ]
  }
});

if (conflit) {
  throw new ConflictException('OVERLAPPING_LEAVE_REQUEST: Une absence existe déjà sur cette période.');
}
```

### B. Contrôle du Solde Disponible
$$\text{Solde Disponible} = \text{Cumul Acquis} + \text{Ajustements} - \text{Absences Consommées} - \text{Absences en Cours}$$
Si $\text{Durée Demandée} > \text{Solde Disponible}$ et que l'anticipation est désactivée :
`BadRequestException('INSUFFICIENT_LEAVE_BALANCE')`.

---

## 2. Moteur de Calcul de Paie (`PayrollEngine`)

Le calcul d'un bulletin s'effectue en cascade séquentielle :

```text
1. SALAIRE BRUT TOTAL
   = Salaire de base contractuel
   + Heures supplémentaires (majorées de 12%, 35%, 50%, 100%)
   + Primes fixes (logement, transport) + Primes variables
   
2. ASSIETTE COTISATIONS SOCIALES
   = Salaire Brut plafonné selon le barème CNSS
   - Part Salariale Retraite (ex: 3,6 % ou 4 %)
   ──────────────────────────────────────────────────────────
   = SALAIRE BRUT ABATTU
   
3. SALAIRE NET IMPOSABLE
   = Salaire Brut Abattu - Déduction forfaitaire pour frais pro
   
4. IMPÔT SUR LE REVENU SALARIÉ (IRPP / ITS)
   = Application du barème progressif par tranches
   - Abattement pour charges de famille (conjoint, enfants)
   
5. NET À PAYER FINAL
   = Brut - Cotisations Salariales - Impôt Retenu - Acomptes versés
```

### Règle d'Immuabilité des Bulletins Clôturés :
Un bulletin validé et clôturé pour le mois $M$ est verrouillé (`statut: 'CLOTURE'`). Toute régularisation ultérieure est obligatoirement imputée sur le bulletin du mois $M+1$.

---

## 3. Référentiel des Barèmes Fiscaux & Paramètres Sociaux Dynamiques (EF-001)

Pour garantir une stricte conformité avec le principe d'absence de taux codés en dur (**SFD EF-001**), le moteur de calcul `CalculPaieService` et le simulateur s'alimentent dynamiquement depuis le sous-module `src/modules/rh/referentiel/` :

### A. Composants Métier Clés
- **Barème ITS Bénin 2026 (Art. 125 CGI) :** 5 tranches progressives (0%, 10%, 15%, 20%, 30%) gérées dans `RhBaremeIts` et `RhBaremeItsTranche`.
- **Contrôle d'Intégrité et Continuité des Tranches :** Validation stricte interdisant les discontinuités (trous) ou les chevauchements entre les bornes minimales et maximales des tranches adjacentes.
- **Duplication d'Exercice :** Clonage transactionnel d'un barème d'une année $N$ vers $N+1$ avec option d'activation immédiate.
- **Cotisations Sociales & Patronales :** CNSS Salariale (3,6%), CNSS Patronale (17,4% ventilée en Prestations familiales 9%, AT/MP 2%, Retraite 6,4%), et Versement Patronal sur Salaires (VPS 4% standard, 2% enseignement).
- **Redevance Audiovisuelle ORTB (Art. 125-2 CGI) :** Retenues spécifiques en Mars (1 000 FCFA) et Juin (3 000 FCFA), avec exonération légale en Juin pour la tranche 1 (salaire net imposable $\le$ 50 000 FCFA).
- **Évaluation des Avantages en Nature (Art. 123 CGI 2026) :** Logement de fonction (15%), domesticité (15%), véhicule, eau, électricité, téléphone.
- **Paramètres Pays :** SMIG (52 000 FCFA), base 40h/semaine, majorations d'heures supplémentaires légales.

> 📖 **Documentation Complète & Algorithmes :** Consultez le guide dédié [**04b - Barèmes Fiscaux & Cotisations Sociales**](./04b-baremes-fiscaux-et-cotisations.md) pour les détails mathématiques, les diagrammes de flux et le catalogue d'API REST.

