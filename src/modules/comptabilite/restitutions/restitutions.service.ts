import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class RestitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC-08 : Grand Livre des comptes
   * Uniquement les écritures VALIDEE (EF-034).
   * Calcul du solde progressif avec à-nouveaux (EF-035).
   */
  async getGrandLivre(
    tenantId: string,
    filters: {
      exerciceId?: string;
      compteId?: string;
      compteNumero?: string;
      dateDebut?: string;
      dateFin?: string;
      avecAuxiliaires?: boolean;
    },
  ) {
    const whereLigne: any = {
      ecriture: {
        tenantId,
        statut: 'VALIDEE',
      },
    };

    if (filters.exerciceId) {
      whereLigne.ecriture.exerciceId = filters.exerciceId;
    }
    if (filters.dateDebut || filters.dateFin) {
      whereLigne.ecriture.dateEcriture = {};
      if (filters.dateDebut) {
        whereLigne.ecriture.dateEcriture.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        whereLigne.ecriture.dateEcriture.lte = new Date(filters.dateFin);
      }
    }
    if (filters.compteId) {
      whereLigne.compteId = filters.compteId;
    } else if (filters.compteNumero) {
      whereLigne.compte = { numeroCompte: filters.compteNumero };
    }

    // Récupérer toutes les lignes d'écritures validées ordonnées
    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: whereLigne,
      include: {
        compte: true,
        compteAuxiliaire: true,
        lettrage: true,
        ecriture: {
          include: {
            journal: true,
          },
        },
      },
      orderBy: [
        { ecriture: { dateEcriture: 'asc' } },
        { ecriture: { numEcriture: 'asc' } },
        { ordre: 'asc' },
      ],
    });

    // Regrouper par compte
    const grandLivreParCompte: Record<string, any> = {};

    for (const l of lignes) {
      const cId = l.compteId;
      if (!grandLivreParCompte[cId]) {
        grandLivreParCompte[cId] = {
          compteId: cId,
          numeroCompte: l.compte?.numeroCompte || '',
          intituleCompte: l.compte?.libelle || '',
          classe: l.compte?.classe,
          soldeInitial: 0,
          totalDebit: 0,
          totalCredit: 0,
          soldeFinal: 0,
          lignes: [],
        };
      }

      const debit = Number(l.montantDebit || 0);
      const credit = Number(l.montantCredit || 0);
      grandLivreParCompte[cId].totalDebit += debit;
      grandLivreParCompte[cId].totalCredit += credit;

      // Calcul progressif du solde pour ce compte
      const soldeProgressif =
        grandLivreParCompte[cId].totalDebit - grandLivreParCompte[cId].totalCredit;

      grandLivreParCompte[cId].lignes.push({
        id: l.id,
        dateEcriture: l.ecriture.dateEcriture,
        numEcriture: l.ecriture.numEcriture,
        journalCode: l.ecriture.journal.codeJournal,
        journalLibelle: l.ecriture.journal.libelle,
        pieceRef: l.ecriture.refPiece,
        libelle: l.libelleLigne || l.ecriture.libelle,
        debit,
        credit,
        soldeProgressif,
        lettrageCode: l.lettrage?.codeLettre,
        compteAuxiliaire: l.compteAuxiliaire
          ? {
              id: l.compteAuxiliaire.id,
              code: l.compteAuxiliaire.numeroAuxiliaire,
              intitule: l.compteAuxiliaire.libelle,
            }
          : null,
      });
    }

    // Calcul final pour chaque compte
    const result = Object.values(grandLivreParCompte).map((compteData: any) => {
      compteData.soldeFinal = compteData.totalDebit - compteData.totalCredit;
      return compteData;
    });

    // Tri par numéro de compte SYSCOHADA
    result.sort((a, b) => a.numeroCompte.localeCompare(b.numeroCompte));

    return result;
  }

  /**
   * UC-09 : Balance Générale 6 colonnes
   * Solde Initial (Débit/Crédit), Mouvements (Débit/Crédit), Solde Final (Débit/Crédit)
   * Équilibre de contrôle (EF-037)
   */
  async getBalanceGenerale(
    tenantId: string,
    filters: {
      exerciceId: string;
      periodeId?: string;
      dateDebut?: string;
      dateFin?: string;
    },
  ) {
    if (!filters.exerciceId) {
      throw new NotFoundException('exerciceId est obligatoire pour la balance.');
    }

    // Récupérer tous les comptes actifs du tenant
    const comptes = await (this.prisma as any).comptaCompte.findMany({
      where: { tenantId, statut: 'ACTIF' },
      orderBy: { numeroCompte: 'asc' },
    });

    const whereLigne: any = {
      ecriture: {
        tenantId,
        exerciceId: filters.exerciceId,
        statut: 'VALIDEE',
      },
    };

    if (filters.periodeId) {
      whereLigne.ecriture.periodeId = filters.periodeId;
    }
    if (filters.dateDebut || filters.dateFin) {
      whereLigne.ecriture.dateEcriture = {};
      if (filters.dateDebut) {
        whereLigne.ecriture.dateEcriture.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        whereLigne.ecriture.dateEcriture.lte = new Date(filters.dateFin);
      }
    }

    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: whereLigne,
      select: {
        compteId: true,
        montantDebit: true,
        montantCredit: true,
        ecriture: {
          select: {
            journal: { select: { typeJournal: true } },
          },
        },
      },
    });

    // Mouvements par compte
    const aggregats: Record<string, { debit: number; credit: number; anDebit: number; anCredit: number }> = {};
    for (const l of lignes) {
      if (!aggregats[l.compteId]) {
        aggregats[l.compteId] = { debit: 0, credit: 0, anDebit: 0, anCredit: 0 };
      }
      const d = Number(l.montantDebit || 0);
      const c = Number(l.montantCredit || 0);

      // Si écriture à nouveau
      if (l.ecriture?.journal?.typeJournal === 'A_NOUVEAUX') {
        aggregats[l.compteId].anDebit += d;
        aggregats[l.compteId].anCredit += c;
      } else {
        aggregats[l.compteId].debit += d;
        aggregats[l.compteId].credit += c;
      }
    }

    const lignesBalance: any[] = [];
    let totaux = {
      soldeInitialDebit: 0,
      soldeInitialCredit: 0,
      mouvementsDebit: 0,
      mouvementsCredit: 0,
      soldeFinalDebit: 0,
      soldeFinalCredit: 0,
    };

    for (const c of comptes) {
      const agg = aggregats[c.id] || { debit: 0, credit: 0, anDebit: 0, anCredit: 0 };
      const hasMovement =
        agg.debit > 0 || agg.credit > 0 || agg.anDebit > 0 || agg.anCredit > 0;

      // On n'affiche que les comptes mouvementés ou ayant un solde
      if (!hasMovement) continue;

      const diffInitial = agg.anDebit - agg.anCredit;
      const soldeInitDeb = diffInitial > 0 ? diffInitial : 0;
      const soldeInitCred = diffInitial < 0 ? Math.abs(diffInitial) : 0;

      const mouvDeb = agg.debit;
      const mouvCred = agg.credit;

      const soldeNet = diffInitial + mouvDeb - mouvCred;
      const soldeFinDeb = soldeNet > 0 ? soldeNet : 0;
      const soldeFinCred = soldeNet < 0 ? Math.abs(soldeNet) : 0;

      totaux.soldeInitialDebit += soldeInitDeb;
      totaux.soldeInitialCredit += soldeInitCred;
      totaux.mouvementsDebit += mouvDeb;
      totaux.mouvementsCredit += mouvCred;
      totaux.soldeFinalDebit += soldeFinDeb;
      totaux.soldeFinalCredit += soldeFinCred;

      lignesBalance.push({
        compteId: c.id,
        numero: c.numeroCompte,
        intitule: c.libelle,
        classe: c.classe,
        soldeInitialDebit: soldeInitDeb,
        soldeInitialCredit: soldeInitCred,
        mouvementsDebit: mouvDeb,
        mouvementsCredit: mouvCred,
        soldeFinalDebit: soldeFinDeb,
        soldeFinalCredit: soldeFinCred,
      });
    }

    const estEquilibree =
      Math.abs(totaux.mouvementsDebit - totaux.mouvementsCredit) < 0.01 &&
      Math.abs(totaux.soldeFinalDebit - totaux.soldeFinalCredit) < 0.01;

    return {
      exerciceId: filters.exerciceId,
      periodeId: filters.periodeId || null,
      estEquilibree,
      totaux,
      lignes: lignesBalance,
    };
  }

  /**
   * UC-09 : Balance Auxiliaire (Comptes de tiers classe 4)
   */
  async getBalanceAuxiliaire(
    tenantId: string,
    filters: {
      exerciceId: string;
      compteCollectifId?: string;
    },
  ) {
    const where: any = {
      compte: { tenantId, classe: 4 },
      compteAuxiliaireId: { not: null },
      ecriture: {
        tenantId,
        exerciceId: filters.exerciceId,
        statut: 'VALIDEE',
      },
    };

    if (filters.compteCollectifId) {
      where.compteId = filters.compteCollectifId;
    }

    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where,
      include: {
        compte: true,
        compteAuxiliaire: true,
      },
    });

    const auxMap: Record<string, any> = {};

    for (const l of lignes) {
      const auxId = l.compteAuxiliaireId;
      if (!auxMap[auxId]) {
        auxMap[auxId] = {
          compteAuxiliaireId: auxId,
          codeAuxiliaire: l.compteAuxiliaire?.numeroAuxiliaire || '',
          intituleAuxiliaire: l.compteAuxiliaire?.libelle || '',
          compteCollectifNumero: l.compte?.numeroCompte || '',
          compteCollectifIntitule: l.compte?.libelle || '',
          totalDebit: 0,
          totalCredit: 0,
          soldeDebit: 0,
          soldeCredit: 0,
        };
      }

      const d = Number(l.montantDebit || 0);
      const c = Number(l.montantCredit || 0);
      auxMap[auxId].totalDebit += d;
      auxMap[auxId].totalCredit += c;
    }

    const result = Object.values(auxMap).map((item: any) => {
      const solde = item.totalDebit - item.totalCredit;
      item.soldeDebit = solde > 0 ? solde : 0;
      item.soldeCredit = solde < 0 ? Math.abs(solde) : 0;
      return item;
    });

    result.sort((a, b) => (a.codeAuxiliaire || '').localeCompare(b.codeAuxiliaire || ''));
    return result;
  }
}
