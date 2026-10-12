import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class LettrageRapprochementService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // UC-10 : LETTRAGE DES COMPTES DE TIERS
  // =========================================================================

  /**
   * Récupère les lignes non lettrées pour un compte auxiliaire donné
   */
  async getLignesNonLettrees(tenantId: string, compteAuxiliaireId: string) {
    return (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        compteAuxiliaireId,
        lettrageId: null,
        ecriture: {
          tenantId,
          statut: 'VALIDEE',
        },
      },
      include: {
        compte: true,
        compteAuxiliaire: true,
        ecriture: {
          include: {
            journal: true,
          },
        },
      },
      orderBy: { ecriture: { dateEcriture: 'asc' } },
    });
  }

  /**
   * Lettrage manuel de lignes sélectionnées
   */
  async lettrerManuel(
    tenantId: string,
    dto: {
      compteAuxiliaireId: string;
      ligneIds: string[];
      codeLettre?: string;
    },
    userId: string,
  ) {
    if (!dto.ligneIds || dto.ligneIds.length < 2) {
      throw new BadRequestException(
        'Le lettrage requiert au moins deux lignes à rapprocher.',
      );
    }

    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        id: { in: dto.ligneIds },
        compteAuxiliaireId: dto.compteAuxiliaireId,
        lettrageId: null,
        ecriture: { tenantId, statut: 'VALIDEE' },
      },
    });

    if (lignes.length !== dto.ligneIds.length) {
      throw new BadRequestException(
        'Certaines lignes sont introuvables, déjà lettrées ou non validées.',
      );
    }

    let totDebit = 0;
    let totCredit = 0;
    for (const l of lignes) {
      totDebit += Number(l.montantDebit || 0);
      totCredit += Number(l.montantCredit || 0);
    }

    const diff = Math.abs(totDebit - totCredit);
    const statut = diff < 0.01 ? 'COMPLET' : 'PARTIEL';

    // Générer code lettre (A, B... Z, AA, AB...)
    let codeLettre = dto.codeLettre;
    if (!codeLettre) {
      codeLettre = await this.genererProchainCodeLettre(
        tenantId,
        dto.compteAuxiliaireId,
      );
    }

    const lettrage = await (this.prisma as any).comptaLettrage.create({
      data: {
        tenantId,
        compteAuxiliaireId: dto.compteAuxiliaireId,
        codeLettre,
        statut,
        automatique: false,
        lettrePar: userId,
        delettre: false,
      },
    });

    // Mettre à jour les lignes avec l'id du lettrage
    await (this.prisma as any).comptaEcritureLigne.updateMany({
      where: { id: { in: dto.ligneIds } },
      data: { lettrageId: lettrage.id },
    });

    return {
      lettrage,
      totDebit,
      totCredit,
      statut,
      nbLignes: lignes.length,
    };
  }

  /**
   * Lettrage automatique sur montants stricts identiques et sens opposé (EF-038, EF-040)
   */
  async lettrerAutomatique(
    tenantId: string,
    compteAuxiliaireId: string,
    userId: string,
  ) {
    const lignes = await this.getLignesNonLettrees(tenantId, compteAuxiliaireId);

    const debits = lignes.filter((l: any) => Number(l.montantDebit) > 0);
    const credits = lignes.filter((l: any) => Number(l.montantCredit) > 0);

    const rapprochements: any[][] = [];
    const usedDebits = new Set<string>();
    const usedCredits = new Set<string>();

    for (const d of debits) {
      if (usedDebits.has(d.id)) continue;
      const montantD = Number(d.montantDebit);

      // Trouver un crédit avec exactement le même montant
      const match = credits.find(
        (c: any) => !usedCredits.has(c.id) && Math.abs(Number(c.montantCredit) - montantD) < 0.01,
      );

      if (match) {
        usedDebits.add(d.id);
        usedCredits.add(match.id);
        rapprochements.push([d, match]);
      }
    }

    const createdLettrages: any[] = [];
    for (const [deb, cred] of rapprochements) {
      const codeLettre = await this.genererProchainCodeLettre(
        tenantId,
        compteAuxiliaireId,
      );

      const lettrage = await (this.prisma as any).comptaLettrage.create({
        data: {
          tenantId,
          compteAuxiliaireId,
          codeLettre,
          statut: 'COMPLET',
          automatique: true,
          lettrePar: userId,
        },
      });

      await (this.prisma as any).comptaEcritureLigne.updateMany({
        where: { id: { in: [deb.id, cred.id] } },
        data: { lettrageId: lettrage.id },
      });

      createdLettrages.push({ codeLettre, debitId: deb.id, creditId: cred.id });
    }

    return {
      compteAuxiliaireId,
      nbRapprochements: createdLettrages.length,
      lettrages: createdLettrages,
    };
  }

  /**
   * Délettrage d'un lettrage existant (EF-038)
   */
  async delettrer(tenantId: string, lettrageId: string, userId: string) {
    const lettrage = await (this.prisma as any).comptaLettrage.findFirst({
      where: { id: lettrageId, tenantId },
    });

    if (!lettrage) {
      throw new NotFoundException('Lettrage introuvable.');
    }

    // Retirer lettrageId des lignes
    await (this.prisma as any).comptaEcritureLigne.updateMany({
      where: { lettrageId },
      data: { lettrageId: null },
    });

    // Marquer le lettrage comme délettré
    return (this.prisma as any).comptaLettrage.update({
      where: { id: lettrageId },
      data: { delettre: true },
    });
  }

  private async genererProchainCodeLettre(
    tenantId: string,
    compteAuxiliaireId: string,
  ): Promise<string> {
    const count = await (this.prisma as any).comptaLettrage.count({
      where: { tenantId, compteAuxiliaireId },
    });

    // Convert count to letters (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
    let n = count;
    let code = '';
    do {
      code = String.fromCharCode(65 + (n % 26)) + code;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);

    return code;
  }

  // =========================================================================
  // UC-11 : RAPPROCHEMENT BANCAIRE
  // =========================================================================

  /**
   * Import de relevé bancaire (EF-041, EF-042)
   */
  async importerReleve(
    tenantId: string,
    dto: {
      journalId: string;
      formatSource: 'CSV' | 'OFX' | 'MT940';
      dateDebut: string;
      dateFin: string;
      soldeOuverture?: number;
      soldeCloture?: number;
      lignes: Array<{
        dateOperation: string;
        libelle: string;
        montant: number;
        referenceBancaire?: string;
      }>;
    },
    userId: string,
  ) {
    const journal = await (this.prisma as any).comptaJournal.findFirst({
      where: { id: dto.journalId, tenantId },
    });

    if (!journal) {
      throw new NotFoundException('Journal introuvable.');
    }

    const releve = await (this.prisma as any).comptaReleveBancaire.create({
      data: {
        tenantId,
        journalId: dto.journalId,
        formatSource: dto.formatSource,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        soldeOuverture: dto.soldeOuverture ?? 0,
        soldeCloture: dto.soldeCloture ?? 0,
        importePar: userId,
      },
    });

    let importedCount = 0;
    let duplicateCount = 0;

    for (const ligne of dto.lignes) {
      // Calcul d'empreinte déduplication EF-042
      const hashInput = `${dto.journalId}_${ligne.dateOperation}_${ligne.montant}_${ligne.libelle.trim().toLowerCase()}_${ligne.referenceBancaire || ''}`;
      const empreinte = crypto.createHash('sha256').update(hashInput).digest('hex');

      try {
        await (this.prisma as any).comptaLigneReleveBancaire.create({
          data: {
            releveId: releve.id,
            dateOperation: new Date(ligne.dateOperation),
            libelle: ligne.libelle,
            montant: ligne.montant,
            referenceBancaire: ligne.referenceBancaire || null,
            empreinteDedup: empreinte,
            statutRapprochement: 'NON_RAPPROCHE',
          },
        });
        importedCount++;
      } catch (err: any) {
        // En cas de doublon sur la contrainte d'unicité
        duplicateCount++;
      }
    }

    return {
      releveId: releve.id,
      importedCount,
      duplicateCount,
    };
  }

  /**
   * Rapprochement automatique (EF-044)
   * Montant strict identique, tolérance date 5 jours
   */
  async rapprocherAutomatique(tenantId: string, releveId: string, userId: string) {
    const releve = await (this.prisma as any).comptaReleveBancaire.findFirst({
      where: { id: releveId, tenantId },
      include: {
        journal: true,
        lignes: { where: { statutRapprochement: 'NON_RAPPROCHE' } },
      },
    });

    if (!releve) {
      throw new NotFoundException('Relevé introuvable.');
    }

    const compteTresorerieId = releve.journal.compteContrepartieId;
    if (!compteTresorerieId) {
      throw new BadRequestException(
        'Le journal de banque doit posséder un compte de contrepartie défini (ex. 521).',
      );
    }

    // Récupérer les écritures de trésorerie non encore rapprochées
    const ecrituresLignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        compteId: compteTresorerieId,
        ecriture: {
          tenantId,
          journalId: releve.journalId,
          statut: 'VALIDEE',
        },
        rapprochements: { none: {} },
      },
      include: { ecriture: true },
    });

    let nbRapproches = 0;
    const usedEcritureIds = new Set<string>();

    for (const lr of releve.lignes) {
      const montantReleve = Number(lr.montant);
      const dateOp = new Date(lr.dateOperation).getTime();

      // Trouver une ligne d'écriture correspondante
      // Note: au relevé bancaire, un encaissement est un crédit bancaire (montant > 0),
      // ce qui correspond au débit du compte 521 en comptabilité.
      const match = ecrituresLignes.find((el: any) => {
        if (usedEcritureIds.has(el.id)) return false;
        const d = Number(el.montantDebit || 0);
        const c = Number(el.montantCredit || 0);
        const montantCompta = d > 0 ? d : -c;

        if (Math.abs(montantCompta - montantReleve) > 0.01) return false;

        const dateEcriture = new Date(el.ecriture.dateEcriture).getTime();
        const diffJours = Math.abs(dateOp - dateEcriture) / (1000 * 3600 * 24);
        return diffJours <= 5; // Fenêtre paramétrable 5 jours (EF-044)
      });

      if (match) {
        usedEcritureIds.add(match.id);

        await (this.prisma as any).comptaRapprochementBancaire.create({
          data: {
            ligneReleveId: lr.id,
            ecritureLigneId: match.id,
            mode: 'AUTOMATIQUE',
            rapprochePar: userId,
          },
        });

        await (this.prisma as any).comptaLigneReleveBancaire.update({
          where: { id: lr.id },
          data: { statutRapprochement: 'RAPPROCHE' },
        });

        nbRapproches++;
      }
    }

    return { releveId, nbRapproches };
  }

  /**
   * Rapprochement manuel
   */
  async rapprocherManuel(
    tenantId: string,
    dto: { ligneReleveId: string; ecritureLigneId: string },
    userId: string,
  ) {
    const ligneReleve = await (this.prisma as any).comptaLigneReleveBancaire.findFirst({
      where: { id: dto.ligneReleveId, releve: { tenantId } },
    });

    if (!ligneReleve) {
      throw new NotFoundException('Ligne de relevé introuvable.');
    }

    const ecritureLigne = await (this.prisma as any).comptaEcritureLigne.findFirst({
      where: { id: dto.ecritureLigneId, ecriture: { tenantId } },
    });

    if (!ecritureLigne) {
      throw new NotFoundException('Ligne d\'écriture introuvable.');
    }

    const rapprochement = await (this.prisma as any).comptaRapprochementBancaire.create({
      data: {
        ligneReleveId: dto.ligneReleveId,
        ecritureLigneId: dto.ecritureLigneId,
        mode: 'MANUEL',
        rapprochePar: userId,
      },
    });

    await (this.prisma as any).comptaLigneReleveBancaire.update({
      where: { id: dto.ligneReleveId },
      data: { statutRapprochement: 'RAPPROCHE' },
    });

    return rapprochement;
  }

  /**
   * Annuler un rapprochement
   */
  async annulerRapprochement(tenantId: string, rapprochementId: string) {
    const rap = await (this.prisma as any).comptaRapprochementBancaire.findFirst({
      where: {
        id: rapprochementId,
        ligneReleve: { releve: { tenantId } },
      },
    });

    if (!rap) {
      throw new NotFoundException('Rapprochement introuvable.');
    }

    await (this.prisma as any).comptaLigneReleveBancaire.update({
      where: { id: rap.ligneReleveId },
      data: { statutRapprochement: 'NON_RAPPROCHE' },
    });

    return (this.prisma as any).comptaRapprochementBancaire.delete({
      where: { id: rapprochementId },
    });
  }

  /**
   * État de rapprochement bancaire
   */
  async getEtatRapprochement(tenantId: string, releveId: string) {
    const releve = await (this.prisma as any).comptaReleveBancaire.findFirst({
      where: { id: releveId, tenantId },
      include: {
        journal: true,
        lignes: {
          include: {
            rapprochements: {
              include: { ecritureLigne: { include: { ecriture: true } } },
            },
          },
        },
      },
    });

    if (!releve) {
      throw new NotFoundException('Relevé introuvable.');
    }

    const soldeBancaireFin = Number(releve.soldeCloture || 0);

    // Lignes de relevé non rapprochées
    const lignesReleveNonRapprochees = releve.lignes.filter(
      (l: any) => l.statutRapprochement === 'NON_RAPPROCHE',
    );

    // Écritures comptables du journal non rapprochées
    const compteTresorerieId = releve.journal.compteContrepartieId;
    const ecrituresNonRapprochees = compteTresorerieId
      ? await (this.prisma as any).comptaEcritureLigne.findMany({
          where: {
            compteId: compteTresorerieId,
            ecriture: {
              tenantId,
              journalId: releve.journalId,
              statut: 'VALIDEE',
              dateEcriture: { lte: releve.dateFin },
            },
            rapprochements: { none: {} },
          },
          include: { ecriture: true },
        })
      : [];

    return {
      releveId,
      journal: releve.journal.libelle,
      dateDebut: releve.dateDebut,
      dateFin: releve.dateFin,
      soldeBancaireFin,
      lignesReleveNonRapprochees,
      ecrituresNonRapprochees,
    };
  }
}
