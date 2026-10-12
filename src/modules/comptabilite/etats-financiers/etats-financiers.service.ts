import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RestitutionsService } from '../restitutions/restitutions.service';

@Injectable()
export class EtatsFinanciersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restitutionsService: RestitutionsService,
  ) {}

  /**
   * UC-17 : Générer les états financiers annuels (Système Normal / SMT)
   * Conformité SYSCOHADA (Bilan, Compte de Résultat, TFT).
   * Règle EF-062 : Total Actif === Total Passif.
   * Règle EF-063 : Edition définitive uniquement sur exercice CLOTURE ou ARCHIVE.
   */
  async genererEtatsFinanciers(
    tenantId: string,
    exerciceId: string,
    options: {
      systemeRetenu?: 'SN' | 'SMT';
      typeEdition?: 'PROVISOIRE' | 'DEFINITIF';
    },
    userId: string,
  ) {
    const exercice = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice comptable introuvable.');
    }

    const typeEdition = options.typeEdition || 'PROVISOIRE';
    if (typeEdition === 'DEFINITIF' && exercice.statut === 'OUVERT') {
      throw new ForbiddenException(
        'Règle EF-063 : Les états financiers définitifs ne peuvent être générés que sur un exercice au statut CLÔTURÉ ou ARCHIVÉ.',
      );
    }

    // Récupérer la balance générale 6 colonnes
    const balance = await this.restitutionsService.getBalanceGenerale(tenantId, {
      exerciceId,
    });

    // 1. Calcul du Compte de Résultat SYSCOHADA
    let produitsExploitation = 0;
    let chargesExploitation = 0;
    let produitsFinanciers = 0;
    let chargesFinancieres = 0;
    let produitsHao = 0;
    let chargesHao = 0;
    let impotSurResultat = 0;

    // 2. Calcul du Bilan SYSCOHADA
    let actifImmobilise = 0;
    let actifCirculant = 0;
    let tresorerieActif = 0;

    let capitauxPropres = 0;
    let dettesFinancieres = 0;
    let passifCirculant = 0;
    let tresoreriePassif = 0;

    for (const ligne of balance.lignes) {
      const num = ligne.numero;
      const soldeDeb = ligne.soldeFinalDebit;
      const soldeCred = ligne.soldeFinalCredit;
      const soldeNet = soldeDeb - soldeCred; // Positif si débiteur, négatif si créditeur

      // Compte de Résultat
      if (num.startsWith('70') || num.startsWith('71') || num.startsWith('72') || num.startsWith('73') || num.startsWith('74') || num.startsWith('75')) {
        produitsExploitation += soldeCred - soldeDeb;
      } else if (num.startsWith('60') || num.startsWith('61') || num.startsWith('62') || num.startsWith('63') || num.startsWith('64') || num.startsWith('65')) {
        chargesExploitation += soldeDeb - soldeCred;
      } else if (num.startsWith('77')) {
        produitsFinanciers += soldeCred - soldeDeb;
      } else if (num.startsWith('67')) {
        chargesFinancieres += soldeDeb - soldeCred;
      } else if (num.startsWith('82') || num.startsWith('84') || num.startsWith('86') || num.startsWith('88')) {
        produitsHao += soldeCred - soldeDeb;
      } else if (num.startsWith('81') || num.startsWith('83') || num.startsWith('85')) {
        chargesHao += soldeDeb - soldeCred;
      } else if (num.startsWith('89') || num.startsWith('695')) {
        impotSurResultat += soldeDeb - soldeCred;
      }

      // Bilan - Actif
      if (num.startsWith('2')) {
        // Immobilisations (brut net amortissement)
        if (num.startsWith('28') || num.startsWith('29')) {
          actifImmobilise -= (soldeCred - soldeDeb);
        } else {
          actifImmobilise += (soldeDeb - soldeCred);
        }
      } else if (num.startsWith('3') || (num.startsWith('41') || num.startsWith('445') || num.startsWith('46'))) {
        // Stocks et créances d'exploitation
        if (soldeNet > 0) actifCirculant += soldeNet;
        else passifCirculant += Math.abs(soldeNet);
      } else if (num.startsWith('5')) {
        // Trésorerie
        if (num.startsWith('56')) {
          // Crédits de trésorerie / découverts
          tresoreriePassif += (soldeCred - soldeDeb);
        } else {
          if (soldeNet > 0) tresorerieActif += soldeNet;
          else tresoreriePassif += Math.abs(soldeNet);
        }
      }

      // Bilan - Passif
      if (num.startsWith('10') || num.startsWith('11') || num.startsWith('12') || num.startsWith('14')) {
        capitauxPropres += (soldeCred - soldeDeb);
      } else if (num.startsWith('16') || num.startsWith('17') || num.startsWith('18')) {
        dettesFinancieres += (soldeCred - soldeDeb);
      } else if (num.startsWith('40') || num.startsWith('42') || num.startsWith('43') || num.startsWith('444')) {
        if (soldeNet < 0) passifCirculant += Math.abs(soldeNet);
        else actifCirculant += soldeNet;
      }
    }

    // Calculs intermédiaires de résultat
    const resultatExploitation = produitsExploitation - chargesExploitation;
    const resultatFinancier = produitsFinanciers - chargesFinancieres;
    const resultatActivitesOrdinaires = resultatExploitation + resultatFinancier;
    const resultatHao = produitsHao - chargesHao;
    const resultatNet = resultatActivitesOrdinaires + resultatHao - impotSurResultat;

    // Intégration du résultat net dans les capitaux propres au passif du bilan (compte 131/139)
    capitauxPropres += resultatNet;

    const totalActif = Math.round((actifImmobilise + actifCirculant + tresorerieActif) * 100) / 100;
    const totalPassif = Math.round((capitauxPropres + dettesFinancieres + passifCirculant + tresoreriePassif) * 100) / 100;

    const bilanEquilibre = Math.abs(totalActif - totalPassif) < 1.0;

    if (typeEdition === 'DEFINITIF' && !bilanEquilibre) {
      throw new BadRequestException(
        `Règle EF-062 : Déséquilibre du bilan détecté ! Total Actif (${totalActif}) != Total Passif (${totalPassif}).`,
      );
    }

    // Sauvegarder dans compta_etat_financier_genere
    const etatGenere = await (this.prisma as any).comptaEtatFinancierGenere.create({
      data: {
        tenantId,
        exerciceId,
        systemeComptable: options.systemeRetenu || 'SN',
        typeEdition,
        totalActif,
        totalPassif,
        generePar: userId,
      },
    });

    return {
      id: etatGenere.id,
      exerciceId,
      annee: exercice.annee,
      systemeComptable: options.systemeRetenu || 'SN',
      typeEdition,
      genereLe: etatGenere.genereLe,
      bilan: {
        actif: {
          actifImmobilise,
          actifCirculant,
          tresorerieActif,
          totalActif,
        },
        passif: {
          capitauxPropres,
          dettesFinancieres,
          passifCirculant,
          tresoreriePassif,
          totalPassif,
        },
        equilibre: bilanEquilibre,
        ecart: Math.abs(totalActif - totalPassif),
      },
      compteResultat: {
        produitsExploitation,
        chargesExploitation,
        resultatExploitation,
        produitsFinanciers,
        chargesFinancieres,
        resultatFinancier,
        resultatActivitesOrdinaires,
        produitsHao,
        chargesHao,
        resultatHao,
        impotSurResultat,
        resultatNet,
      },
      fluxTresorerie: {
        tresorerieNetteDebut: tresorerieActif - tresoreriePassif,
        variationTresorerie: resultatNet,
        tresorerieNetteFin: tresorerieActif - tresoreriePassif + resultatNet,
      },
    };
  }

  /**
   * UC-15 : Exposer le résultat net pour M7 (Fiscalité - IS)
   * Règle EF-057 : Uniquement si l'exercice est CLOTURE ou ARCHIVE.
   */
  async exposerResultatPourM7(tenantId: string, exerciceId: string, moduleDemandeur = 'M7') {
    const exercice = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable.');
    }

    if (exercice.statut !== 'CLOTURE' && exercice.statut !== 'ARCHIVE') {
      throw new ForbiddenException(
        'Règle EF-057 : M7 ne peut consulter le résultat net que si l\'exercice est CLÔTURÉ ou ARCHIVÉ.',
      );
    }

    // Récupérer le solde du compte 131 (Bénéfice) ou 139 (Perte)
    const soldeResultat = await (this.prisma as any).comptaSoldePeriodique.findFirst({
      where: {
        tenantId,
        compte: { numero: { in: ['131', '139', '13'] } },
      },
      orderBy: { recalculeLe: 'desc' },
    });

    const resultatNet = soldeResultat ? Number(soldeResultat.soldeCumule) : 0;

    // Tracer la lecture externe (EF-057)
    await (this.prisma as any).comptaLectureResultatExterne.create({
      data: {
        exerciceId,
        moduleDemandeur,
        resultatNetLu: resultatNet,
      },
    });

    await (this.prisma as any).comptaJournalAudit.create({
      data: {
        tenantId,
        categorie: 'LECTURE_EXTERNE',
        action: 'LECTURE_RESULTAT_POUR_IS',
        entiteType: 'ComptaExercice',
        entiteId: exerciceId,
        detailsJson: { moduleDemandeur, resultatNet, annee: exercice.annee },
        acteurId: moduleDemandeur,
      },
    });

    return {
      exerciceId,
      annee: exercice.annee,
      statut: exercice.statut,
      resultatNet,
      dateCloture: exercice.dateCloture,
    };
  }

  /**
   * UC-16 : Recevoir l'écriture retour d'Impôt sur les Sociétés depuis M7
   * Règle EF-058 : Générée systématiquement au statut BROUILLON dans le journal OD.
   */
  async recevoirEcritureRetourIs(
    tenantId: string,
    dto: {
      exerciceId: string;
      montantIs: number;
      referenceCalculIsExterne: string;
    },
    userId?: string,
  ) {
    const exercice = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: dto.exerciceId, tenantId },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable.');
    }

    const journalOd = await (this.prisma as any).comptaJournal.findFirst({
      where: { tenantId, codeJournal: 'OD' },
    });
    if (!journalOd) {
      throw new BadRequestException('Journal OD introuvable.');
    }

    // Résoudre compte 695 (Impôt sur le résultat) et 444 (Dette IS)
    const compte695 = await (this.prisma as any).comptaCompte.findFirst({
      where: { tenantId, numeroCompte: { startsWith: '695' } },
    });
    const compte444 = await (this.prisma as any).comptaCompte.findFirst({
      where: { tenantId, numeroCompte: { startsWith: '444' } },
    });

    if (!compte695 || !compte444) {
      throw new BadRequestException('Comptes 695 ou 444 introuvables dans le plan comptable.');
    }

    // Trouver la dernière période de l'exercice
    const dernierePeriode = await (this.prisma as any).comptaPeriode.findFirst({
      where: { exerciceId: dto.exerciceId },
      orderBy: { anneeMois: 'desc' },
    });

    const anneeEx = new Date(exercice.dateDebut).getFullYear();

    const ecriture = await (this.prisma as any).comptaEcriture.create({
      data: {
        tenantId,
        exerciceId: dto.exerciceId,
        periodeId: dernierePeriode?.id,
        journalId: journalOd.id,
        dateEcriture: new Date(`${anneeEx}-12-31`),
        libelle: `Constatation Impôt sur les Sociétés - Réf M7: ${dto.referenceCalculIsExterne}`,
        refPiece: dto.referenceCalculIsExterne,
        datePiece: new Date(),
        statut: 'BROUILLON', // EF-058 : toujours en brouillon
        origine: 'M7',
        saisiPar: userId || 'M7_FISCALITE',
        lignes: {
          create: [
            {
              ordre: 1,
              compteId: compte695.id,
              libelleLigne: `Charge d'impôt sur les bénéfices ${exercice.annee}`,
              montantDebit: dto.montantIs,
              montantCredit: 0,
            },
            {
              ordre: 2,
              compteId: compte444.id,
              libelleLigne: `État, impôt sur les sociétés exigible`,
              montantDebit: 0,
              montantCredit: dto.montantIs,
            },
          ],
        },
      },
    });

    return {
      ecritureId: ecriture.id,
      statut: 'BROUILLON',
      montantIs: dto.montantIs,
      message: 'Écriture d\'impôt sur les sociétés créée avec succès au statut BROUILLON.',
    };
  }
}
