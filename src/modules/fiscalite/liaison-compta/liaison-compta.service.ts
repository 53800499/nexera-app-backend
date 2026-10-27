import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { ImpotSocietesService } from '../is/is.service';
import { TvaService } from '../tva/tva.service';

export interface DonneesComptablesIs {
  exerciceFiscalId: string;
  exerciceComptableId?: string;
  annee: number;
  statutExerciceComptable: string;
  resultatComptableNet: number;
  produitsEncaissables: number;
  totalProduitsClasse7: number;
  totalChargesClasse6: number;
  chiffreAffairesClasse70: number;
  nombreEcrituresComptabilisees: number;
  nombreLignesAnalyses: number;
  derniereLecture: Date;
  detailsClasses: {
    classe6Charges: { numero: string; libelle: string; montantDebit: number; montantCredit: number; solde: number }[];
    classe7Produits: { numero: string; libelle: string; montantDebit: number; montantCredit: number; solde: number }[];
  };
}

export interface CadrageTvaResult {
  declarationId: string;
  periode: string;
  statutDeclaration: string;
  concordanceGlobale: 'CONFORME' | 'ECART_DETECTE' | 'AUCUNE_ECRITURE';
  tvaCollecteeDeclaree: number;
  tvaCollecteeComptabilisee: number;
  ecartTvaCollectee: number;
  tvaDeductibleDeclaree: number;
  tvaDeductibleComptabilisee: number;
  ecartTvaDeductible: number;
  creditTvaAnterieur: number;
  tvaNetteDueDeclaree: number;
  tvaNetteDueComptabilisee: number;
  ecartTvaNetteDue: number;
  chiffreAffairesHtComptabilise: number;
  baseHorsTaxeDeclaree: number;
  ecartBaseHt: number;
  ecritureLiquidationM3?: {
    id: string;
    numEcriture: string;
    statut: string;
    dateEcriture: Date;
    libelle: string;
  } | null;
  lignesAudit: {
    compte: string;
    intitule: string;
    sens: string;
    montantDeclare: number;
    soldeComptable: number;
    ecart: number;
    statut: 'CONFORME' | 'ANOMALIE';
  }[];
}

@Injectable()
export class LiaisonComptaService {
  private readonly logger = new Logger(LiaisonComptaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationBus: IntegrationEventBus,
    private readonly isService: ImpotSocietesService,
    private readonly tvaService: TvaService,
  ) {}

  /**
   * COMPTABILITÉ ➔ FISCALITÉ (IS)
   * Extrait automatiquement le résultat comptable net (Classes 6 et 7)
   * et le chiffre d'affaires / produits encaissables (Compte 70x) depuis le Grand Livre.
   * Trace la consultation dans tax_solde_comptable_consulte (EF-044) et compta_lecture_resultat_externe.
   */
  async getDonneesComptablesPourIs(exerciceId: string, tenantId?: string): Promise<DonneesComptablesIs> {
    const ex = await (this.prisma as any).taxExerciceFiscal.findUnique({
      where: { id: exerciceId },
      include: {
        contribuable: true,
        calculIs: true,
      },
    });

    if (!ex) {
      throw new NotFoundException('Exercice fiscal introuvable.');
    }

    const resolvedTenantId = tenantId || ex.contribuable?.tenantId;
    const annee = new Date(ex.dateDebut).getFullYear();

    // 1. Trouver l'exercice comptable correspondant (M3)
    let comptaEx: any = null;
    if (ex.exerciceComptableRefId) {
      comptaEx = await (this.prisma as any).comptaExercice.findFirst({
        where: { id: ex.exerciceComptableRefId, tenantId: resolvedTenantId },
      });
    }

    if (!comptaEx) {
      comptaEx = await (this.prisma as any).comptaExercice.findFirst({
        where: {
          tenantId: resolvedTenantId,
          dateDebut: { lte: ex.dateDebut },
          dateFin: { gte: ex.dateFin },
        },
        orderBy: { dateDebut: 'desc' },
      });
    }

    if (!comptaEx) {
      // Recherche par année
      comptaEx = await (this.prisma as any).comptaExercice.findFirst({
        where: {
          tenantId: resolvedTenantId,
          dateDebut: { gte: new Date(`${annee}-01-01T00:00:00.000Z`) },
          dateFin: { lte: new Date(`${annee}-12-31T23:59:59.999Z`) },
        },
        orderBy: { dateDebut: 'desc' },
      });
    }

    if (!comptaEx) {
      // Dernier exercice du tenant
      comptaEx = await (this.prisma as any).comptaExercice.findFirst({
        where: { tenantId: resolvedTenantId },
        orderBy: { dateDebut: 'desc' },
      });
    }

    if (!comptaEx) {
      this.logger.warn(`Aucun exercice comptable trouvé pour le tenant ${resolvedTenantId}.`);
      return {
        exerciceFiscalId: ex.id,
        annee,
        statutExerciceComptable: 'NON_INITIALISE',
        resultatComptableNet: ex.calculIs?.resultatComptableNet || 0,
        produitsEncaissables: ex.calculIs?.produitsEncaissables || 0,
        totalProduitsClasse7: 0,
        totalChargesClasse6: 0,
        chiffreAffairesClasse70: 0,
        nombreEcrituresComptabilisees: 0,
        nombreLignesAnalyses: 0,
        derniereLecture: new Date(),
        detailsClasses: { classe6Charges: [], classe7Produits: [] },
      };
    }

    // 2. Récupérer toutes les lignes d'écritures validées (ou brouillons si pas encore validées)
    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        ecriture: {
          tenantId: resolvedTenantId,
          exerciceId: comptaEx.id,
          statut: { in: ['VALIDEE', 'BROUILLON'] },
        },
      },
      include: {
        compte: true,
        ecriture: { select: { id: true, numEcriture: true, statut: true, dateEcriture: true } },
      },
    });

    const ecrituresSet = new Set<string>();
    let totalChargesClasse6 = 0;
    let totalProduitsClasse7 = 0;
    let chiffreAffairesClasse70 = 0;

    const chargesMap: Record<string, { numero: string; libelle: string; montantDebit: number; montantCredit: number; solde: number }> = {};
    const produitsMap: Record<string, { numero: string; libelle: string; montantDebit: number; montantCredit: number; solde: number }> = {};

    for (const l of lignes) {
      ecrituresSet.add(l.ecriture?.id || l.id);
      const num = l.compte?.numeroCompte || l.compte?.numero || '';
      const lib = l.compte?.libelle || l.compte?.intitule || `Compte ${num}`;
      const d = Number(l.montantDebit || 0);
      const c = Number(l.montantCredit || 0);

      // Classe 6 : Charges (Solde Débiteur = Débit - Crédit)
      if (num.startsWith('6')) {
        totalChargesClasse6 += d - c;
        if (!chargesMap[num]) {
          chargesMap[num] = { numero: num, libelle: lib, montantDebit: 0, montantCredit: 0, solde: 0 };
        }
        chargesMap[num].montantDebit += d;
        chargesMap[num].montantCredit += c;
        chargesMap[num].solde += d - c;
      }

      // Classe 7 : Produits (Solde Créditeur = Crédit - Débit)
      if (num.startsWith('7')) {
        totalProduitsClasse7 += c - d;
        if (!produitsMap[num]) {
          produitsMap[num] = { numero: num, libelle: lib, montantDebit: 0, montantCredit: 0, solde: 0 };
        }
        produitsMap[num].montantDebit += d;
        produitsMap[num].montantCredit += c;
        produitsMap[num].solde += c - d;

        // Compte 70x : Ventes et Chiffre d'Affaires
        if (num.startsWith('70')) {
          chiffreAffairesClasse70 += c - d;
        }
      }
    }

    // Résultat comptable net = Total Produits (Classe 7) - Total Charges (Classe 6)
    const resultatComptableNet = Math.round((totalProduitsClasse7 - totalChargesClasse6) * 100) / 100;
    const produitsEncaissables = Math.round(
      (chiffreAffairesClasse70 > 0 ? chiffreAffairesClasse70 : totalProduitsClasse7 > 0 ? totalProduitsClasse7 : 0) * 100,
    ) / 100;

    // 3. Traçabilité de consultation (EF-044)
    try {
      await (this.prisma as any).taxSoldeComptableConsulte.create({
        data: {
          taxExerciceFiscalId: ex.id,
          compteSyscohadaConsulte: 'Classes 6 & 7 / Résultat Net M3',
          soldeLu: resultatComptableNet,
          exerciceComptableStatutALaLecture: comptaEx.statut,
        },
      });

      await (this.prisma as any).comptaLectureResultatExterne.create({
        data: {
          exerciceId: comptaEx.id,
          moduleDemandeur: 'M7',
          referenceCalculIsExterne: ex.id,
          resultatNetLu: resultatComptableNet,
        },
      });
    } catch (e: any) {
      this.logger.debug(`Trace de lecture comptable enregistrée avec statut: ${e.message}`);
    }

    return {
      exerciceFiscalId: ex.id,
      exerciceComptableId: comptaEx.id,
      annee,
      statutExerciceComptable: comptaEx.statut,
      resultatComptableNet,
      produitsEncaissables,
      totalProduitsClasse7: Math.round(totalProduitsClasse7 * 100) / 100,
      totalChargesClasse6: Math.round(totalChargesClasse6 * 100) / 100,
      chiffreAffairesClasse70: Math.round(chiffreAffairesClasse70 * 100) / 100,
      nombreEcrituresComptabilisees: ecrituresSet.size,
      nombreLignesAnalyses: lignes.length,
      derniereLecture: new Date(),
      detailsClasses: {
        classe6Charges: Object.values(chargesMap).sort((a, b) => a.numero.localeCompare(b.numero)),
        classe7Produits: Object.values(produitsMap).sort((a, b) => a.numero.localeCompare(b.numero)),
      },
    };
  }

  /**
   * COMPTABILITÉ ➔ FISCALITÉ (Synchronisation & recalcul de l'IS)
   * Extrait les données réelles et met à jour immédiatement le calcul officiel d'IS.
   */
  async synchroniserDonneesComptablesPourIs(exerciceId: string, tenantId?: string, userId?: string) {
    const data = await this.getDonneesComptablesPourIs(exerciceId, tenantId);

    // Mettre à jour l'exercice fiscal avec les montants extraits
    const updated = await this.isService.calculerEtEnregistrer(
      exerciceId,
      data.resultatComptableNet,
      data.produitsEncaissables,
      userId,
    );

    return {
      message: 'Données comptables du Grand Livre synchronisées et calcul de l\'IS mis à jour avec succès.',
      donneesComptables: data,
      exerciceFiscal: updated,
    };
  }

  /**
   * COMPTABILITÉ ⟷ FISCALITÉ (CADRAGE TVA)
   * Rapproche la déclaration mensuelle de TVA avec les soldes des comptes SYSCOHADA (4431, 445x, 70x).
   */
  async getCadrageTva(declarationId: string, tenantId?: string): Promise<CadrageTvaResult> {
    const dec = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: { id: declarationId },
      include: {
        contribuable: true,
        lignes: true,
      },
    });

    if (!dec) {
      throw new NotFoundException('Déclaration de TVA introuvable.');
    }

    const resolvedTenantId = tenantId || dec.contribuable?.tenantId;
    const periode = dec.periode; // format: 'YYYY-MM'
    const [yearStr, monthStr] = periode.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const debutMois = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const finMois = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0));

    // Récupérer les lignes comptables pour ce mois
    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        ecriture: {
          tenantId: resolvedTenantId,
          dateEcriture: { gte: debutMois, lt: finMois },
          statut: { in: ['VALIDEE', 'BROUILLON'] },
        },
      },
      include: {
        compte: true,
        ecriture: true,
      },
    });

    let solde443Collectee = 0;
    let solde445Deductible = 0;
    let solde70ChiffreAffaires = 0;

    for (const l of lignes) {
      const num = l.compte?.numeroCompte || l.compte?.numero || '';
      const d = Number(l.montantDebit || 0);
      const c = Number(l.montantCredit || 0);

      // Compte 4431 / 443x : TVA facturée / collectée (Crédit - Débit)
      if (num.startsWith('443')) {
        solde443Collectee += c - d;
      }

      // Comptes 445x : TVA déductible / récupérable (Débit - Crédit)
      if (num.startsWith('445')) {
        solde445Deductible += d - c;
      }

      // Comptes 70x : Ventes et Chiffre d'Affaires taxable (Crédit - Débit)
      if (num.startsWith('70')) {
        solde70ChiffreAffaires += c - d;
      }
    }

    solde443Collectee = Math.round(solde443Collectee * 100) / 100;
    solde445Deductible = Math.round(solde445Deductible * 100) / 100;
    solde70ChiffreAffaires = Math.round(solde70ChiffreAffaires * 100) / 100;

    const tvaCollectee = Number(dec.tvaCollecteeTotale ?? dec.tvaCollectee ?? 0);
    const tvaDeductible = Number(dec.tvaDeductibleTotale ?? dec.tvaDeductible ?? 0);
    const tvaNetteDue = Number(dec.tvaNetteDue ?? (tvaCollectee - tvaDeductible - (dec.creditTvaAnterieur || 0)));

    const baseHorsTaxeDeclaree = Math.round(
      (dec.lignes && dec.lignes.length > 0
        ? dec.lignes
            .filter((l: any) => l.nature === 'VENTE_TAXABLE' || l.nature === 'VENTE_EXONEREE')
            .reduce((sum: number, l: any) => sum + (l.baseHorsTaxe || 0), 0)
        : Number(dec.baseHorsTaxe || 0)) * 100,
    ) / 100;

    const ecartCollectee = Math.round((solde443Collectee - tvaCollectee) * 100) / 100;
    const ecartDeductible = Math.round((solde445Deductible - tvaDeductible) * 100) / 100;
    const tvaNetteComptable = Math.round((solde443Collectee - solde445Deductible - (dec.creditTvaAnterieur || 0)) * 100) / 100;
    const ecartNette = Math.round((tvaNetteComptable - tvaNetteDue) * 100) / 100;
    const ecartBase = Math.round((solde70ChiffreAffaires - baseHorsTaxeDeclaree) * 100) / 100;

    const estConforme = Math.abs(ecartCollectee) < 1 && Math.abs(ecartDeductible) < 1;

    // Rechercher si l'écriture de liquidation a été générée en M3
    const ecritureLiquidation = await (this.prisma as any).comptaEcriture.findFirst({
      where: {
        tenantId: resolvedTenantId,
        refPiece: { in: [`LIQ-TVA-${periode}`, `TVA-${periode}`] },
      },
      select: {
        id: true,
        numEcriture: true,
        statut: true,
        dateEcriture: true,
        libelle: true,
      },
    });

    const lignesAudit: CadrageTvaResult['lignesAudit'] = [
      {
        compte: '4431',
        intitule: 'État, TVA facturée sur ventes (Collectée)',
        sens: 'CRÉDIT',
        montantDeclare: tvaCollectee,
        soldeComptable: solde443Collectee,
        ecart: ecartCollectee,
        statut: Math.abs(ecartCollectee) < 1 ? 'CONFORME' : 'ANOMALIE',
      },
      {
        compte: '4451-4454',
        intitule: 'État, TVA récupérable (Déductible)',
        sens: 'DÉBIT',
        montantDeclare: tvaDeductible,
        soldeComptable: solde445Deductible,
        ecart: ecartDeductible,
        statut: Math.abs(ecartDeductible) < 1 ? 'CONFORME' : 'ANOMALIE',
      },
      {
        compte: '701-707',
        intitule: "Chiffre d'affaires taxable (Produits des ventes)",
        sens: 'CRÉDIT',
        montantDeclare: baseHorsTaxeDeclaree,
        soldeComptable: solde70ChiffreAffaires,
        ecart: ecartBase,
        statut: Math.abs(ecartBase) < 1 ? 'CONFORME' : 'ANOMALIE',
      },
      {
        compte: '4441 / 4449',
        intitule: 'TVA Nette due (ou Crédit reportable)',
        sens: tvaNetteDue >= 0 ? 'CRÉDIT' : 'DÉBIT',
        montantDeclare: tvaNetteDue,
        soldeComptable: tvaNetteComptable,
        ecart: ecartNette,
        statut: Math.abs(ecartNette) < 1 ? 'CONFORME' : 'ANOMALIE',
      },
    ];

    return {
      declarationId: dec.id,
      periode: dec.periode,
      statutDeclaration: dec.statut,
      concordanceGlobale: lignes.length === 0 ? 'AUCUNE_ECRITURE' : estConforme ? 'CONFORME' : 'ECART_DETECTE',
      tvaCollecteeDeclaree: tvaCollectee,
      tvaCollecteeComptabilisee: solde443Collectee,
      ecartTvaCollectee: ecartCollectee,
      tvaDeductibleDeclaree: tvaDeductible,
      tvaDeductibleComptabilisee: solde445Deductible,
      ecartTvaDeductible: ecartDeductible,
      creditTvaAnterieur: dec.creditTvaAnterieur || 0,
      tvaNetteDueDeclaree: tvaNetteDue,
      tvaNetteDueComptabilisee: tvaNetteComptable,
      ecartTvaNetteDue: ecartNette,
      chiffreAffairesHtComptabilise: solde70ChiffreAffaires,
      baseHorsTaxeDeclaree,
      ecartBaseHt: ecartBase,
      ecritureLiquidationM3: ecritureLiquidation,
      lignesAudit,
    };
  }

  /**
   * FISCALITÉ ➔ COMPTABILITÉ (Forcer génération OD liquidation TVA)
   */
  async genererOdLiquidationTva(declarationId: string, tenantId?: string) {
    const dec = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: { id: declarationId },
      include: { contribuable: true },
    });

    if (!dec) {
      throw new NotFoundException('Déclaration de TVA introuvable.');
    }

    const resolvedTenantId = tenantId || dec.contribuable?.tenantId;

    // Déclencher la validation / émission de l'événement
    const updated = await this.tvaService.validerDeclaration(declarationId);

    return {
      message: `Écriture de liquidation de TVA pour la période ${dec.periode} générée avec succès en comptabilité (Journal OD).`,
      declaration: updated,
    };
  }
}
