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

    // A. Événements avec lignes déjà fournies (M4 RH & Paie, M5 Notes de frais, etc.) (EF-023, EF-024)
    if (payload.lignes && Array.isArray(payload.lignes) && payload.lignes.length >= 2) {
      const codeJournalDefaut = payload.codeJournal || (evenement.moduleSource === 'M4' ? 'PAIE' : 'OD');
      let journal = await (this.prisma as any).comptaJournal.findFirst({
        where: { tenantId, codeJournal: codeJournalDefaut },
      });
      if (!journal && codeJournalDefaut === 'BQ') {
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
        throw new BadRequestException('Aucun journal comptable disponible pour ce flux.');
      }

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
          compte = await (this.prisma as any).comptaCompte.findFirst({
            where: { numeroCompte: num, tenantId },
          });

          // Recherche par racine de compte si le sous-compte exact n'existe pas
          if (!compte && num.length >= 3) {
            compte = await (this.prisma as any).comptaCompte.findFirst({
              where: {
                tenantId,
                numeroCompte: { startsWith: num.substring(0, 3) },
                statut: 'ACTIF',
              },
              orderBy: { numeroCompte: 'asc' },
            });
          }

          // Auto-création sécurisée du compte SYSCOHADA si non existant
          if (!compte) {
            const defaultLibelle =
              num.startsWith('443') ? 'État, TVA facturée sur ventes' :
              num.startsWith('445') ? 'État, TVA récupérable sur achats et services' :
              num.startsWith('4441') ? 'État, TVA due' :
              num.startsWith('4449') ? 'État, crédit de TVA à reporter' :
              num.startsWith('4412') ? 'État, acomptes sur impôts sur les bénéfices' :
              num.startsWith('444') || num.startsWith('4411') ? 'État, impôts sur les bénéfices (IS)' :
              num.startsWith('695') ? 'Impôts sur les bénéfices et sociétés' :
              num.startsWith('891') ? 'Impôt sur le résultat' :
              num.startsWith('521') ? 'Banque locale' :
              `Compte ${num}`;

            try {
              compte = await (this.prisma as any).comptaCompte.create({
                data: {
                  tenantId,
                  numeroCompte: num,
                  libelle: defaultLibelle,
                  classe: Number(num[0]) || 4,
                  statut: 'ACTIF',
                },
              });
            } catch (e) {
              compte = await (this.prisma as any).comptaCompte.findFirst({
                where: { numeroCompte: num, tenantId },
              });
            }
          }
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

      if (Math.abs(totDebit - totCredit) > 0.01) {
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

    // B. Moteur de règles paramétrable (M1 Ventes, M2 Stocks, M7 Paiements, etc.) (EF-021, EF-022)
    const eventAliases: Record<string, string[]> = {
      'payment.recorded': ['payment.recorded', 'payment.received'],
      'payment.received': ['payment.received', 'payment.recorded'],
      'payroll.cycle.validated': ['payroll.cycle.validated', 'rh.payroll.cycle_validated'],
      'rh.payroll.cycle_validated': ['rh.payroll.cycle_validated', 'payroll.cycle.validated'],
      'expense_report.approved': ['expense_report.approved', 'ndf.report_approved'],
      'ndf.report_approved': ['ndf.report_approved', 'expense_report.approved'],
      'invoice.issued': ['invoice.issued'],
      'credit_note.issued': ['credit_note.issued', 'invoice.cancelled'],
      'invoice.cancelled': ['invoice.cancelled', 'credit_note.issued'],
      'stock.inventory_closed': ['stock.inventory_closed'],
      'stock.valuation_updated': ['stock.valuation_updated', 'stock.valuation_computed'],
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

    if (regles.length === 0) {
      throw new BadRequestException(
        `Aucune règle de comptabilisation active configurée pour l'événement ${evenement.typeEvenement} (EF-020).`,
      );
    }

    // Filtrer par critères de spécificité (EF-027)
    let matchingRegle: any = null;
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

    if (!matchingRegle) {
      throw new BadRequestException('Aucune règle de comptabilisation valide trouvée.');
    }

    let journalId = matchingRegle.journalCibleId;
    let compteDebitId = matchingRegle.compteDebitId;
    let compteCreditId = matchingRegle.compteCreditId;

    if (!compteDebitId || !compteCreditId) {
      const fallbackRegle = regles.find((r: any) => r.compteDebitId && r.compteCreditId);
      if (fallbackRegle) {
        if (!compteDebitId) compteDebitId = fallbackRegle.compteDebitId;
        if (!compteCreditId) compteCreditId = fallbackRegle.compteCreditId;
        if (!journalId) journalId = fallbackRegle.journalCibleId;
      }
    }

    if (!compteDebitId) {
      const defNum = evenement.typeEvenement.includes('invoice') ? '411' :
                     evenement.typeEvenement.includes('payment') ? '521' :
                     evenement.typeEvenement.includes('payroll') ? '661' :
                     evenement.typeEvenement.includes('expense') ? '62' : '471';
      const c = await (this.prisma as any).comptaCompte.findFirst({
        where: { tenantId, numeroCompte: { startsWith: defNum }, statut: 'ACTIF' },
        orderBy: { numeroCompte: 'asc' },
      });
      if (c) compteDebitId = c.id;
    }

    if (!compteCreditId) {
      const defNum = evenement.typeEvenement.includes('invoice') ? '701' :
                     evenement.typeEvenement.includes('payment') ? '411' :
                     evenement.typeEvenement.includes('payroll') ? '421' :
                     evenement.typeEvenement.includes('expense') ? '421' : '471';
      const c = await (this.prisma as any).comptaCompte.findFirst({
        where: { tenantId, numeroCompte: { startsWith: defNum }, statut: 'ACTIF' },
        orderBy: { numeroCompte: 'asc' },
      });
      if (c) compteCreditId = c.id;
    }

    if (!compteDebitId || !compteCreditId) {
      throw new BadRequestException(
        'Impossible de déterminer les comptes de débit et crédit pour cette règle de comptabilisation.',
      );
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
    if (!montantHt) {
      montantHt = payload.tauxTva
        ? montantTotal / (1 + Number(payload.tauxTva) / 100)
        : montantTotal;
    }
    const montantTva = Math.max(0, Math.round((montantTotal - montantHt) * 100) / 100);

    const lignes: any[] = [];
    lignes.push({
      ordre: 1,
      compteId: compteDebitId,
      compteAuxiliaireId: payload.compteAuxiliaireId || null,
      libelleLigne: payload.libelle || `${evenement.typeEvenement} - ${evenement.referenceExterne}`,
      montantDebit: Math.round(montantTotal * 100) / 100,
      montantCredit: 0,
    });

    if (montantTva > 0.01) {
      const compteTva = await (this.prisma as any).comptaCompte.findFirst({
        where: { tenantId, numeroCompte: { startsWith: '443' }, statut: 'ACTIF' },
      });

      lignes.push({
        ordre: 2,
        compteId: compteCreditId,
        libelleLigne: `${payload.libelle || evenement.typeEvenement} HT`,
        montantDebit: 0,
        montantCredit: Math.round(montantHt * 100) / 100,
      });

      if (compteTva) {
        lignes.push({
          ordre: 3,
          compteId: compteTva.id,
          libelleLigne: 'TVA collectée',
          montantDebit: 0,
          montantCredit: montantTva,
        });
      } else {
        lignes[1].montantCredit = Math.round(montantTotal * 100) / 100;
      }
    } else {
      lignes.push({
        ordre: 2,
        compteId: compteCreditId,
        libelleLigne: payload.libelle || `${evenement.typeEvenement} ${evenement.referenceExterne}`,
        montantDebit: 0,
        montantCredit: Math.round(montantTotal * 100) / 100,
      });
    }

    return (this.prisma as any).comptaEcriture.create({
      data: {
        tenantId,
        exerciceId: exercice.id,
        periodeId: periode.id,
        journalId,
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
}
