import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class MoteurReglesService {
  constructor(private readonly prisma: PrismaService) {}

  private formatRegle(r: any) {
    if (!r) return r;
    return {
      ...r,
      compteDebit: r.compteDebit
        ? {
            ...r.compteDebit,
            numero: r.compteDebit.numeroCompte,
            numeroCompte: r.compteDebit.numeroCompte,
            intitule: r.compteDebit.libelle,
            libelle: r.compteDebit.libelle,
          }
        : null,
      compteCredit: r.compteCredit
        ? {
            ...r.compteCredit,
            numero: r.compteCredit.numeroCompte,
            numeroCompte: r.compteCredit.numeroCompte,
            intitule: r.compteCredit.libelle,
            libelle: r.compteCredit.libelle,
          }
        : null,
    };
  }

  /**
   * Lister les règles de comptabilisation actives du tenant
   */
  async getRegles(tenantId: string) {
    const list = await (this.prisma as any).comptaRegleComptabilisation.findMany({
      where: { tenantId },
      include: {
        compteDebit: true,
        compteCredit: true,
        journalCible: true,
      },
      orderBy: [{ typeEvenement: 'asc' }, { niveauSpecificite: 'desc' }],
    });
    return list.map((r: any) => this.formatRegle(r));
  }

  /**
   * Créer une règle de comptabilisation
   */
  async createRegle(tenantId: string, dto: any, userId: string) {
    // Calculer niveau de spécificité (EF-027)
    let specificite = 0;
    if (dto.critereCategorieArticle) specificite++;
    if (dto.critereTauxTva !== undefined && dto.critereTauxTva !== null)
      specificite++;
    if (dto.critereTypeTiers) specificite++;

    const created = await (this.prisma as any).comptaRegleComptabilisation.create({
      data: {
        tenantId,
        paysId: dto.paysId || null,
        typeEvenement: dto.typeEvenement,
        critereCategorieArticle: dto.critereCategorieArticle || null,
        critereTauxTva: dto.critereTauxTva !== undefined && dto.critereTauxTva !== null ? String(dto.critereTauxTva) : null,
        critereTypeTiers: dto.critereTypeTiers || null,
        compteDebitId: dto.compteDebitId || null,
        compteCreditId: dto.compteCreditId || null,
        journalCibleId: dto.journalCibleId,
        niveauSpecificite: specificite,
        actif: dto.actif ?? true,
        creePar: userId,
      },
      include: {
        compteDebit: true,
        compteCredit: true,
        journalCible: true,
      },
    });
    return this.formatRegle(created);
  }

  /**
   * Modifier une règle
   */
  async updateRegle(tenantId: string, id: string, dto: any, userId: string) {
    const regle = await (this.prisma as any).comptaRegleComptabilisation.findFirst({
      where: { id, tenantId },
    });
    if (!regle) {
      throw new NotFoundException('Règle de comptabilisation introuvable.');
    }

    let specificite = 0;
    const cat = dto.critereCategorieArticle !== undefined ? dto.critereCategorieArticle : regle.critereCategorieArticle;
    const tva = dto.critereTauxTva !== undefined ? dto.critereTauxTva : regle.critereTauxTva;
    const tiers = dto.critereTypeTiers !== undefined ? dto.critereTypeTiers : regle.critereTypeTiers;
    if (cat) specificite++;
    if (tva !== null && tva !== undefined) specificite++;
    if (tiers) specificite++;

    const updated = await (this.prisma as any).comptaRegleComptabilisation.update({
      where: { id },
      data: {
        ...dto,
        critereTauxTva: dto.critereTauxTva !== undefined ? (dto.critereTauxTva !== null ? String(dto.critereTauxTva) : null) : undefined,
        niveauSpecificite: specificite,
        modifiePar: userId,
      },
      include: {
        compteDebit: true,
        compteCredit: true,
        journalCible: true,
      },
    });
    return this.formatRegle(updated);
  }

  /**
   * Supprimer une règle
   */
  async deleteRegle(tenantId: string, id: string) {
    const regle = await (this.prisma as any).comptaRegleComptabilisation.findFirst({
      where: { id, tenantId },
    });
    if (!regle) {
      throw new NotFoundException('Règle de comptabilisation introuvable.');
    }

    return (this.prisma as any).comptaRegleComptabilisation.delete({
      where: { id },
    });
  }

  /**
   * Lister les événements amont reçus
   */
  async getEvenements(
    tenantId: string,
    filters: { statutTraitement?: string; moduleSource?: string },
  ) {
    const where: any = { tenantId };
    if (filters.statutTraitement) {
      where.statutTraitement = filters.statutTraitement;
    }
    if (filters.moduleSource) {
      where.moduleSource = filters.moduleSource;
    }

    return (this.prisma as any).comptaEvenementSource.findMany({
      where,
      include: {
        ecrituresGenerees: {
          select: {
            id: true,
            numEcriture: true,
            statut: true,
            libelle: true,
          },
        },
      },
      orderBy: { recuLe: 'desc' },
      take: 100,
    });
  }

  /**
   * UC-06 : Recevoir et pré-comptabiliser un événement amont (M1, M2, M4, M5, M7)
   * Crée systématiquement une écriture au statut BROUILLON (EF-019).
   */
  async ingererEvenement(
    tenantId: string,
    dto: {
      moduleSource: 'M1' | 'M2' | 'M4' | 'M5' | 'M7';
      typeEvenement: string;
      referenceExterne: string;
      payload: any;
    },
    userId?: string,
  ) {
    // 1. Enregistrer l'événement source
    const evenement = await (this.prisma as any).comptaEvenementSource.create({
      data: {
        tenantId,
        moduleSource: dto.moduleSource,
        typeEvenement: dto.typeEvenement,
        referenceExterne: dto.referenceExterne,
        payload: dto.payload,
        statutTraitement: 'RECU',
      },
    });

    // 2. Traitement selon le module source
    try {
      const ecriture = await this.traiterEvenement(tenantId, evenement, userId);

      await (this.prisma as any).comptaEvenementSource.update({
        where: { id: evenement.id },
        data: {
          statutTraitement: 'TRAITE',
          ecritureGenereeId: ecriture.id,
          traiteLe: new Date(),
        },
      });

      return {
        evenementId: evenement.id,
        statut: 'TRAITE',
        ecritureId: ecriture.id,
      };
    } catch (err: any) {
      await (this.prisma as any).comptaEvenementSource.update({
        where: { id: evenement.id },
        data: {
          statutTraitement: 'ANOMALIE',
          motifAnomalie: err.message || 'Erreur lors de la comptabilisation',
        },
      });

      return {
        evenementId: evenement.id,
        statut: 'ANOMALIE',
        erreur: err.message,
      };
    }
  }

  /**
   * Retraiter un événement en anomalie
   */
  async retraiterEvenement(tenantId: string, evenementId: string, userId?: string) {
    const evenement = await (this.prisma as any).comptaEvenementSource.findFirst({
      where: { id: evenementId, tenantId },
    });

    if (!evenement) {
      throw new NotFoundException('Événement introuvable.');
    }

    try {
      const ecriture = await this.traiterEvenement(tenantId, evenement, userId);

      await (this.prisma as any).comptaEvenementSource.update({
        where: { id: evenement.id },
        data: {
          statutTraitement: 'TRAITE',
          ecritureGenereeId: ecriture.id,
          motifAnomalie: null,
          traiteLe: new Date(),
        },
      });

      return {
        evenementId: evenement.id,
        statut: 'TRAITE',
        ecritureId: ecriture.id,
      };
    } catch (err: any) {
      await (this.prisma as any).comptaEvenementSource.update({
        where: { id: evenement.id },
        data: {
          statutTraitement: 'ANOMALIE',
          motifAnomalie: err.message,
        },
      });

      throw err;
    }
  }

  /**
   * Logique interne de mapping et création de l'écriture BROUILLON
   */
  private async traiterEvenement(
    tenantId: string,
    evenement: any,
    userId?: string,
  ) {
    const payload = evenement.payload || {};
    const dateEcriture = payload.dateEcriture || payload.issueDate || payload.occurredAt
      ? new Date(payload.dateEcriture || payload.issueDate || payload.occurredAt)
      : new Date();

    // 1. Trouver l'exercice et la période correspondante
    let exercice = await (this.prisma as any).comptaExercice.findFirst({
      where: {
        tenantId,
        dateDebut: { lte: dateEcriture },
        dateFin: { gte: dateEcriture },
        statut: 'OUVERT',
      },
    });
    if (!exercice) {
      exercice = await (this.prisma as any).comptaExercice.findFirst({
        where: { tenantId, statut: 'OUVERT' },
        orderBy: { dateDebut: 'desc' },
      });
    }
    if (!exercice) {
      throw new BadRequestException(
        `Aucun exercice comptable OUVERT trouvé pour la date ${dateEcriture.toISOString().substring(0, 10)}.`,
      );
    }

    const y = dateEcriture.getFullYear();
    const m = dateEcriture.getMonth() + 1;
    const anneeMois = `${y}-${m < 10 ? '0' + m : m}`;

    const periode = await (this.prisma as any).comptaPeriode.findFirst({
      where: {
        exerciceId: exercice.id,
        anneeMois,
        statut: 'OUVERTE',
      },
    });
    if (!periode) {
      throw new BadRequestException(
        `Aucune période mensuelle OUVERTE trouvée pour le mois ${anneeMois} (exercice fiscal ${exercice.id}).`,
      );
    }

    // A. Événements avec lignes déjà fournies (M4 RH & Paie, M5 Notes de frais, M7 Fiscalité, etc.) (EF-023, EF-024)
    if (payload.lignes && Array.isArray(payload.lignes) && payload.lignes.length >= 2) {
      const codeJournalDefaut = payload.codeJournal || (evenement.moduleSource === 'M4' ? 'PAIE' : 'OD');
      const journal = await this.resolveJournal(tenantId, codeJournalDefaut);

      const lignesPayload = payload.lignes;
      const lignesData: any[] = [];
      let totDebit = 0;
      let totCredit = 0;

      for (let i = 0; i < lignesPayload.length; i++) {
        const lp = lignesPayload[i];
        let compte: any = null;
        if (lp.compteId) {
          compte = await (this.prisma as any).comptaCompte.findFirst({
            where: { id: lp.compteId, tenantId },
          });
        } else if (lp.compteNumero || lp.numero) {
          const num = String(lp.compteNumero || lp.numero).trim();
          compte = await this.ensureCompte(tenantId, num, lp.libelleLigne || lp.libelle);
        }

        if (!compte) {
          throw new BadRequestException(
            `Compte introuvable : ${lp.compteNumero || lp.numero || lp.compteId}`,
          );
        }

        const debit = Number(lp.montantDebit || 0);
        const credit = Number(lp.montantCredit || 0);
        totDebit += debit;
        totCredit += credit;

        lignesData.push({
          ordre: i + 1,
          compteId: compte.id,
          compteAuxiliaireId: lp.compteAuxiliaireId || null,
          libelleLigne: lp.libelleLigne || payload.libelle || `Opération ${evenement.referenceExterne}`,
          montantDebit: debit,
          montantCredit: credit,
        });
      }

      if (Math.abs(totDebit - totCredit) > 0.05) {
        throw new BadRequestException(
          `Écriture déséquilibrée : Débit=${totDebit}, Crédit=${totCredit}`,
        );
      }

      const resolveOrigine = (source?: string): string => {
        if (!source) return 'MOTEUR_REGLES';
        if (source.includes('M4')) return 'M4';
        if (source.includes('M5')) return 'M5';
        if (source.includes('M7')) return 'M7';
        return 'MOTEUR_REGLES';
      };

      return (this.prisma as any).comptaEcriture.create({
        data: {
          tenantId,
          exerciceId: exercice.id,
          periodeId: periode.id,
          journalId: journal.id,
          evenementSourceId: evenement.id,
          dateEcriture,
          libelle: payload.libelle || `Événement ${evenement.moduleSource} - ${evenement.referenceExterne}`,
          refPiece: evenement.referenceExterne,
          datePiece: payload.datePiece ? new Date(payload.datePiece) : dateEcriture,
          statut: 'BROUILLON', // Toujours brouillon (EF-019)
          origine: resolveOrigine(evenement.moduleSource),
          saisiPar: userId || 'SYSTEM_EVENT_BUS',
          lignes: { create: lignesData },
        },
      });
    }

    // B. Moteur de règles paramétrable avec fallback SYSCOHADA (EF-021, EF-022, EF-027)
    const eventAliases: Record<string, string[]> = {
      'payment.recorded': ['payment.recorded', 'payment.received'],
      'payment.received': ['payment.received', 'payment.recorded'],
      'payment.cancelled': ['payment.cancelled'],
      'payroll.cycle.validated': ['payroll.cycle.validated', 'rh.payroll.cycle_validated'],
      'rh.payroll.cycle_validated': ['rh.payroll.cycle_validated', 'payroll.cycle.validated'],
      'expense_report.approved': ['expense_report.approved', 'ndf.report_approved', 'ndf.expense_approved'],
      'ndf.report_approved': ['ndf.report_approved', 'expense_report.approved', 'ndf.expense_approved'],
      'ndf.expense_approved': ['ndf.expense_approved', 'expense_report.approved', 'ndf.report_approved'],
      'invoice.issued': ['invoice.issued'],
      'credit_note.issued': ['credit_note.issued', 'invoice.cancelled'],
      'invoice.cancelled': ['invoice.cancelled', 'credit_note.issued'],
      'stock.inventory_closed': ['stock.inventory_closed'],
      'stock.valuation_updated': ['stock.valuation_updated', 'stock.valuation_computed'],
      'fiscalite.tva.liquidee': ['fiscalite.tva.liquidee'],
      'fiscalite.tva.payee': ['fiscalite.tva.payee'],
      'fiscalite.is.valide': ['fiscalite.is.valide'],
      'fiscalite.is.acompte_paye': ['fiscalite.is.acompte_paye'],
    };
    const targetTypes = eventAliases[evenement.typeEvenement] || [evenement.typeEvenement];

    const regles = await (this.prisma as any).comptaRegleComptabilisation.findMany({
      where: {
        tenantId,
        typeEvenement: { in: targetTypes },
        actif: true,
      },
      include: {
        compteDebit: true,
        compteCredit: true,
        journalCible: true,
      },
      orderBy: [{ niveauSpecificite: 'desc' }, { modifieLe: 'desc' }],
    });

    // Filtrer par critères de spécificité (EF-027)
    let matchingRegle: any = null;
    if (regles.length > 0) {
      for (const r of regles) {
        let match = true;
        if (r.critereCategorieArticle && r.critereCategorieArticle !== payload.categorieArticle) {
          match = false;
        }
        if (
          r.critereTauxTva !== null &&
          Number(r.critereTauxTva) !== Number(payload.tauxTva)
        ) {
          match = false;
        }
        if (r.critereTypeTiers && r.critereTypeTiers !== payload.typeTiers) {
          match = false;
        }
        if (match) {
          matchingRegle = r;
          break;
        }
      }
      if (!matchingRegle) {
        matchingRegle = regles.find((r: any) => r.niveauSpecificite === 0) || regles[0];
      }
    }

    // Détermination dynamique du journal et des comptes (Règle personnalisée ou Schéma SYSCOHADA par défaut)
    let journal: any = null;
    let compteDebitId: string | null = null;
    let compteCreditId: string | null = null;

    if (matchingRegle) {
      journal = matchingRegle.journalCible || (matchingRegle.journalCibleId ? await (this.prisma as any).comptaJournal.findUnique({ where: { id: matchingRegle.journalCibleId } }) : null);
      compteDebitId = matchingRegle.compteDebitId;
      compteCreditId = matchingRegle.compteCreditId;
    }

    const typeEvt = evenement.typeEvenement;
    const isCreditNote = typeEvt.includes('credit_note') || typeEvt.includes('cancelled');
    const isPayment = typeEvt.includes('payment');
    const isStock = typeEvt.includes('stock');
    const isExpense = typeEvt.includes('expense') || typeEvt.includes('ndf');
    const isPayroll = typeEvt.includes('payroll') || typeEvt.includes('rh');
    const isFiscalite = typeEvt.includes('fiscalite');

    const preferredJournalCode = matchingRegle?.journalCible?.codeJournal || (
      typeEvt.includes('invoice') || isCreditNote ? 'VE' :
      isPayment || typeEvt.includes('payee') || typeEvt.includes('acompte_paye') ? (payload.modePaiement === 'ESPECES' ? 'CA' : 'BQ') :
      isPayroll ? 'PAIE' :
      isExpense ? 'NDF' : 'OD'
    );

    if (!journal) {
      journal = await this.resolveJournal(tenantId, preferredJournalCode);
    }

    if (!compteDebitId) {
      const defNum =
        typeEvt === 'payment.cancelled' ? '4111' :
        typeEvt.includes('invoice.issued') ? '4111' :
        isCreditNote ? '7011' :
        isPayment ? (payload.modePaiement === 'ESPECES' ? '5711' : '5211') :
        isStock ? '6031' :
        isPayroll ? '6611' :
        isExpense ? '6281' :
        typeEvt.includes('tva.liquidee') ? '4431' :
        typeEvt.includes('tva.payee') ? '4441' :
        typeEvt.includes('is.valide') ? '695' :
        typeEvt.includes('is.acompte_paye') ? '4412' : '4711';

      const c = await this.ensureCompte(tenantId, defNum);
      compteDebitId = c.id;
    }

    if (!compteCreditId) {
      const defNum =
        typeEvt === 'payment.cancelled' ? '5211' :
        typeEvt.includes('invoice.issued') ? '7011' :
        isCreditNote ? '4111' :
        isPayment ? '4111' :
        isStock ? '3111' :
        isPayroll ? '4211' :
        isExpense ? '4261' :
        typeEvt.includes('tva.liquidee') ? '4451' :
        typeEvt.includes('tva.payee') ? '5211' :
        typeEvt.includes('is.valide') ? '444' :
        typeEvt.includes('is.acompte_paye') ? '5211' : '4712';

      const c = await this.ensureCompte(tenantId, defNum);
      compteCreditId = c.id;
    }

    // Extraction des montants
    let montantTotal = Number(
      payload.montantTotal ||
      payload.montantTtc ||
      payload.montant ||
      payload.totalValue ||
      payload.totalAdjustmentsValue ||
      0,
    );
    if (!montantTotal && Array.isArray(payload.lines) && payload.lines.length > 0) {
      montantTotal = payload.lines.reduce(
        (s: number, l: any) => s + Number(l.lineTotalTtc || l.lineTotalHt || 0),
        0,
      );
    }
    if (!montantTotal && Array.isArray(payload.amounts) && payload.amounts.length > 0) {
      montantTotal = payload.amounts.reduce(
        (s: number, a: any) => s + Number(a.amount || 0),
        0,
      );
    }
    if (!montantTotal && Array.isArray(payload.depenses) && payload.depenses.length > 0) {
      montantTotal = payload.depenses.reduce(
        (s: number, d: any) => s + Number(d.montantTtc || d.montantHt || 0),
        0,
      );
    }

    if (montantTotal <= 0) {
      throw new BadRequestException('Le montant de l\'opération doit être strictement supérieur à zéro.');
    }

    let montantHt = Number(payload.montantHt || 0);
    if (!montantHt && Array.isArray(payload.lines)) {
      montantHt = payload.lines.reduce((s: number, l: any) => s + Number(l.lineTotalHt || 0), 0);
    }
    if (!montantHt && (typeEvt.includes('invoice') || isExpense)) {
      montantHt = payload.tauxTva
        ? montantTotal / (1 + Number(payload.tauxTva) / 100)
        : montantTotal;
    } else if (!montantHt) {
      montantHt = montantTotal;
    }
    const montantTva = Math.max(0, Math.round((montantTotal - montantHt) * 100) / 100);

    const lignes: any[] = [];

    // Schéma pour les avoirs et annulations de factures :
    // Débit : 7011 Ventes HT
    // Débit : 4431 TVA facturée régularisée
    // Crédit : 4111 Clients TTC
    if (isCreditNote && !typeEvt.includes('payment')) {
      const compteTva = await this.ensureCompte(tenantId, '4431', 'État, TVA facturée sur ventes');
      lignes.push({
        ordre: 1,
        compteId: compteDebitId, // 7011
        libelleLigne: `${payload.libelle || evenement.typeEvenement} (HT)`,
        montantDebit: Math.round(montantHt * 100) / 100,
        montantCredit: 0,
      });

      if (montantTva > 0.01) {
        lignes.push({
          ordre: 2,
          compteId: compteTva.id, // 4431
          libelleLigne: 'TVA régularisée sur avoir',
          montantDebit: montantTva,
          montantCredit: 0,
        });
      }

      lignes.push({
        ordre: lignes.length + 1,
        compteId: compteCreditId, // 4111
        compteAuxiliaireId: payload.compteAuxiliaireId || null,
        libelleLigne: payload.libelle || `Avoir ${evenement.referenceExterne}`,
        montantDebit: 0,
        montantCredit: Math.round(montantTotal * 100) / 100,
      });
    } else {
      // Schéma standard (Ventes, Paiements, Stocks, NDF, Fiscalité) :
      // Débit : Tiers / Trésorerie / Charge (TTC)
      // Crédit : Produit / Tiers (HT)
      // Crédit : TVA si applicable
      lignes.push({
        ordre: 1,
        compteId: compteDebitId,
        compteAuxiliaireId: payload.compteAuxiliaireId || null,
        libelleLigne: payload.libelle || `${evenement.typeEvenement} - ${evenement.referenceExterne}`,
        montantDebit: Math.round(montantTotal * 100) / 100,
        montantCredit: 0,
      });

      if (montantTva > 0.01 && typeEvt.includes('invoice')) {
        const compteTva = await this.ensureCompte(tenantId, '4431', 'État, TVA facturée sur ventes');

        lignes.push({
          ordre: 2,
          compteId: compteCreditId,
          libelleLigne: `${payload.libelle || evenement.typeEvenement} HT`,
          montantDebit: 0,
          montantCredit: Math.round(montantHt * 100) / 100,
        });

        lignes.push({
          ordre: 3,
          compteId: compteTva.id,
          libelleLigne: 'TVA collectée',
          montantDebit: 0,
          montantCredit: montantTva,
        });
      } else {
        lignes.push({
          ordre: 2,
          compteId: compteCreditId,
          libelleLigne: payload.libelle || `${evenement.typeEvenement} ${evenement.referenceExterne}`,
          montantDebit: 0,
          montantCredit: Math.round(montantTotal * 100) / 100,
        });
      }
    }

    return (this.prisma as any).comptaEcriture.create({
      data: {
        tenantId,
        exerciceId: exercice.id,
        periodeId: periode.id,
        journalId: journal.id,
        evenementSourceId: evenement.id,
        dateEcriture,
        libelle: payload.libelle || `Opération ${evenement.referenceExterne}`,
        refPiece: evenement.referenceExterne,
        datePiece: payload.datePiece ? new Date(payload.datePiece) : dateEcriture,
        statut: 'BROUILLON', // Toujours BROUILLON (EF-019)
        origine: (() => {
          const s = evenement.moduleSource || '';
          if (s.includes('M4')) return 'M4';
          if (s.includes('M5')) return 'M5';
          if (s.includes('M7')) return 'M7';
          return 'MOTEUR_REGLES';
        })(),
        saisiPar: userId || 'SYSTEM_RULES_ENGINE',
        lignes: { create: lignes },
      },
    });
  }

  /**
   * Résolution ou auto-création sécurisée d'un journal comptable (EF-019)
   */
  private async resolveJournal(tenantId: string, preferredCode: string) {
    let journal = await (this.prisma as any).comptaJournal.findFirst({
      where: { tenantId, codeJournal: preferredCode },
    });
    if (!journal && preferredCode === 'BQ') {
      journal = await (this.prisma as any).comptaJournal.findFirst({
        where: { tenantId, typeJournal: 'TRESORERIE_BANQUE' },
      });
    }
    if (!journal) {
      journal = await (this.prisma as any).comptaJournal.findFirst({
        where: { tenantId, codeJournal: 'OD' },
      });
    }
    if (!journal) {
      journal = await (this.prisma as any).comptaJournal.findFirst({
        where: { tenantId },
        orderBy: { creeLe: 'asc' },
      });
    }
    if (!journal) {
      try {
        journal = await (this.prisma as any).comptaJournal.create({
          data: {
            tenantId,
            codeJournal: preferredCode || 'OD',
            libelle:
              preferredCode === 'VE' ? 'Journal des Ventes' :
              preferredCode === 'BQ' ? 'Journal de Banque' :
              preferredCode === 'CA' ? 'Journal de Caisse' :
              preferredCode === 'PAIE' ? 'Journal de Paie' :
              preferredCode === 'NDF' ? 'Journal des Notes de Frais' : 'Opérations Diverses',
            typeJournal:
              preferredCode === 'VE' ? 'VENTES' :
              preferredCode === 'BQ' ? 'TRESORERIE_BANQUE' :
              preferredCode === 'CA' ? 'TRESORERIE_CAISSE' : 'OPERATIONS_DIVERSES',
          },
        });
      } catch {
        journal = await (this.prisma as any).comptaJournal.findFirst({ where: { tenantId } });
      }
    }
    if (!journal) {
      throw new BadRequestException('Aucun journal comptable disponible pour ce flux.');
    }
    return journal;
  }

  /**
   * Résolution ou auto-création d'un compte SYSCOHADA (EF-027)
   */
  private async ensureCompte(tenantId: string, numero: string, defaultLibelle?: string) {
    let compte = await (this.prisma as any).comptaCompte.findFirst({
      where: { numeroCompte: numero, tenantId },
    });

    if (!compte && numero.length >= 3) {
      compte = await (this.prisma as any).comptaCompte.findFirst({
        where: {
          tenantId,
          numeroCompte: { startsWith: numero.substring(0, 3) },
          statut: 'ACTIF',
        },
        orderBy: { numeroCompte: 'asc' },
      });
    }

    if (!compte) {
      const libelle = defaultLibelle || (
        numero.startsWith('411') ? 'Clients' :
        numero.startsWith('701') ? 'Ventes de marchandises / prestations de services' :
        numero.startsWith('521') ? 'Banque locale' :
        numero.startsWith('571') ? 'Caisse centrale' :
        numero.startsWith('603') ? 'Variation des stocks de marchandises' :
        numero.startsWith('311') ? 'Marchandises' :
        numero.startsWith('661') ? 'Rémunérations directes versées au personnel' :
        numero.startsWith('664') ? 'Charges sociales patronales' :
        numero.startsWith('421') ? 'Personnel, rémunérations dues' :
        numero.startsWith('431') ? 'Sécurité Sociale (CNSS)' :
        numero.startsWith('447') ? 'État, impôts et taxes retenus à la source (ITS, VPS)' :
        numero.startsWith('628') ? 'Frais généraux et déplacements' :
        numero.startsWith('426') ? 'Personnel, avances et notes de frais à rembourser' :
        numero.startsWith('443') ? 'État, TVA facturée sur ventes' :
        numero.startsWith('445') ? 'État, TVA récupérable sur achats et services' :
        numero.startsWith('4441') ? 'État, TVA due' :
        numero.startsWith('4449') ? 'État, crédit de TVA à reporter' :
        numero.startsWith('4412') ? 'État, acomptes sur impôts sur les bénéfices' :
        numero.startsWith('444') || numero.startsWith('4411') ? 'État, impôts sur les bénéfices (IS)' :
        numero.startsWith('695') ? 'Impôts sur les bénéfices et sociétés' :
        numero.startsWith('891') ? 'Impôt sur le résultat' : `Compte ${numero}`
      );

      try {
        compte = await (this.prisma as any).comptaCompte.create({
          data: {
            tenantId,
            numeroCompte: numero,
            libelle,
            classe: Number(numero[0]) || 4,
            statut: 'ACTIF',
          },
        });
      } catch {
        compte = await (this.prisma as any).comptaCompte.findFirst({
          where: { numeroCompte: numero, tenantId },
        });
      }
    }

    if (!compte) {
      throw new BadRequestException(`Impossible de résoudre ou créer le compte comptable ${numero}.`);
    }

    return compte;
  }
}
