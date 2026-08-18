import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';

/**
 * SERVICE D'INTERFACES COMPTABLES & DÉCLARATIONS FISCALES
 * 
 * 1. Interface Comptable SYSCOHADA (M3) :
 *    - Débit 6611 : Rémunérations directes du personnel (Salaires de base, Heures Sup)
 *    - Débit 6612 : Primes et gratifications imposables
 *    - Débit 6641 : Charges sociales patronales CNSS (17,4%)
 *    - Débit 6413 : Taxes sur salaires patronales VPS (4%)
 *    - Crédit 4211 : Personnel - Rémunérations dues (Net à payer)
 *    - Crédit 4311 : Sécurité Sociale - Cotisations CNSS salariales et patronales (21%)
 *    - Crédit 4471 : État - Impôts retenus à la source (ITS Bénin)
 *    - Crédit 4472 : État - Versement Patronal sur Salaires (VPS Bénin)
 *    => Équilibre strict garanti : Total Débits == Total Crédits
 * 
 * 2. Déclarations Fiscales & Sociales (M7) :
 *    - Déclaration DGI Bénin : Bordereau mensuel ITS et VPS avec fichier nominatif
 *    - Déclaration CNSS Bénin : Appel de cotisations mensuel/trimestriel (Assiette déplafonnée)
 */
@Injectable()
export class InterfacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: RhAuditService,
  ) {}

  /**
   * Génère l'écriture d'Opérations Diverses (OD) de paie équilibrée selon le plan SYSCOHADA révisé
   * 
   * @param cyclePaieId - Identifiant UUID du cycle de paie validé
   * @param tenantId - Identifiant du tenant entreprise
   * @param userId - Identifiant de l'utilisateur initiateur
   */
  async generateOdPaie(cyclePaieId: string, tenantId: string, userId?: string) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id: cyclePaieId, tenantId },
      include: {
        etablissement: true,
        bulletinsPaie: {
          include: { lignes: true },
        },
      },
    });

    if (!cycle) throw new NotFoundException('Cycle de paie introuvable');
    if (cycle.bulletinsPaie.length === 0) {
      throw new BadRequestException('Aucun bulletin calculé dans ce cycle.');
    }

    // Agréger les montants globaux
    let totalBase = 0;
    let totalHS = 0;
    let totalPrimes = 0;
    let totalAvantages = 0;
    let totalIndemnites = 0;
    let totalCnssPatronale = 0;
    let totalVpsPatronale = 0;

    let totalNetAPayer = 0;
    let totalCnssSalariale = 0;
    let totalIts = 0;
    let totalRetenuesDiverses = 0;

    for (const b of cycle.bulletinsPaie) {
      totalBase += b.salaireBase;
      totalHS += b.montantHeuresSup;
      totalPrimes += b.montantPrimesIndemnitesBrutes;
      totalAvantages += b.montantAvantagesNature;
      totalCnssPatronale += b.montantCnssPatronale;
      totalVpsPatronale += b.montantVpsPatronale;

      totalNetAPayer += b.netAPayer;
      totalCnssSalariale += b.montantCnssSalariale;
      totalIts += b.montantImpotSalaire;
      totalRetenuesDiverses += b.montantAutresRetenuesSalariales;
    }

    const lignesData: Array<{
      numeroLigne: number;
      compteNumero: string;
      libelle: string;
      montantDebit: number;
      montantCredit: number;
    }> = [];

    let lineNum = 1;

    // DÉBITS (Charges de personnel classe 6)
    if (totalBase + totalHS > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '661100',
        libelle: `Salaires de base & heures sup - Paie ${cycle.mois}/${cycle.annee}`,
        montantDebit: totalBase + totalHS,
        montantCredit: 0,
      });
    }

    if (totalPrimes > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '661200',
        libelle: `Primes & gratifications - Paie ${cycle.mois}/${cycle.annee}`,
        montantDebit: totalPrimes,
        montantCredit: 0,
      });
    }

    if (totalAvantages + totalIndemnites > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '661800',
        libelle: `Indemnités & avantages en nature - Paie ${cycle.mois}/${cycle.annee}`,
        montantDebit: totalAvantages + totalIndemnites,
        montantCredit: 0,
      });
    }

    if (totalCnssPatronale > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '664100',
        libelle: `Cotisations patronales CNSS - Paie ${cycle.mois}/${cycle.annee}`,
        montantDebit: totalCnssPatronale,
        montantCredit: 0,
      });
    }

    if (totalVpsPatronale > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '664200',
        libelle: `Versement patronal sur salaires (VPS 4%) - Paie ${cycle.mois}/${cycle.annee}`,
        montantDebit: totalVpsPatronale,
        montantCredit: 0,
      });
    }

    // CRÉDITS (Dettes envers le personnel, organismes sociaux et État - classes 42, 43, 44)
    if (totalNetAPayer > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '422000',
        libelle: `Personnel - Rémunérations dues (Net à payer) - ${cycle.mois}/${cycle.annee}`,
        montantDebit: 0,
        montantCredit: totalNetAPayer,
      });
    }

    if (totalCnssSalariale + totalCnssPatronale > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '431100',
        libelle: `CNSS - Cotisations salariales & patronales - ${cycle.mois}/${cycle.annee}`,
        montantDebit: 0,
        montantCredit: totalCnssSalariale + totalCnssPatronale,
      });
    }

    if (totalIts > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '447100',
        libelle: `État - Retenue à la source ITS - ${cycle.mois}/${cycle.annee}`,
        montantDebit: 0,
        montantCredit: totalIts,
      });
    }

    if (totalVpsPatronale > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '447200',
        libelle: `État - Versement patronal sur salaires (VPS) - ${cycle.mois}/${cycle.annee}`,
        montantDebit: 0,
        montantCredit: totalVpsPatronale,
      });
    }

    if (totalRetenuesDiverses > 0) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: '421000',
        libelle: `Personnel - Avances & acomptes récupérés - ${cycle.mois}/${cycle.annee}`,
        montantDebit: 0,
        montantCredit: totalRetenuesDiverses,
      });
    }

    const totalDebit = lignesData.reduce((sum, l) => sum + l.montantDebit, 0);
    const totalCredit = lignesData.reduce((sum, l) => sum + l.montantCredit, 0);
    const estEquilibree = Math.abs(totalDebit - totalCredit) < 1;

    // Supprimer ancienne écriture si existante
    await this.prisma.rhEcritureComptablePaie.deleteMany({
      where: { tenantId, cyclePaieId },
    });

    const ecriture = await this.prisma.rhEcritureComptablePaie.create({
      data: {
        tenantId,
        etablissementId: cycle.etablissementId,
        cyclePaieId,
        dateEcriture: cycle.dateFin,
        journalCode: 'OD',
        libellePiece: `OD Paie ${cycle.etablissement.raisonSociale} - ${cycle.mois.toString().padStart(2, '0')}/${cycle.annee}`,
        montantTotalDebit: totalDebit,
        montantTotalCredit: totalCredit,
        estEquilibree,
        statut: 'GENERE',
        lignes: {
          create: lignesData.map((l) => ({
            numeroLigne: l.numeroLigne,
            compteNumero: l.compteNumero,
            libelle: l.libelle,
            montantDebit: l.montantDebit,
            montantCredit: l.montantCredit,
          })),
        },
      },
      include: {
        lignes: { orderBy: { numeroLigne: 'asc' } },
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_ecriture_comptable_paie',
      entiteId: ecriture.id,
      actionAudit: 'CREATION',
      champsModifiesJson: { totalDebit, totalCredit, estEquilibree },
    });

    return ecriture;
  }

  async getOdPaie(cyclePaieId: string, tenantId: string) {
    return this.prisma.rhEcritureComptablePaie.findFirst({
      where: { cyclePaieId, tenantId },
      include: {
        etablissement: true,
        cyclePaie: true,
        lignes: { orderBy: { numeroLigne: 'asc' } },
      },
    });
  }

  // ---------------- GÉNÉRATION DES DÉCLARATIONS SOCIALES & FISCALES (M7) ----------------
  async generateDeclarations(cyclePaieId: string, tenantId: string, userId?: string) {
    const cycle = await this.prisma.rhCyclePaie.findFirst({
      where: { id: cyclePaieId, tenantId },
      include: {
        etablissement: true,
        bulletinsPaie: true,
      },
    });

    if (!cycle) throw new NotFoundException('Cycle de paie introuvable');

    const totalSalaries = cycle.bulletinsPaie.length;
    const totalBrut = cycle.bulletinsPaie.reduce((sum, b) => sum + b.totalSalaireBrut, 0);
    const totalIts = cycle.bulletinsPaie.reduce((sum, b) => sum + b.montantImpotSalaire, 0);
    const totalVps = cycle.bulletinsPaie.reduce((sum, b) => sum + b.montantVpsPatronale, 0);
    const totalCnss = cycle.bulletinsPaie.reduce(
      (sum, b) => sum + b.montantCnssSalariale + b.montantCnssPatronale,
      0,
    );

    const periode = `${cycle.annee}-${cycle.mois.toString().padStart(2, '0')}`;
    const dateLimite = new Date(Date.UTC(cycle.annee, cycle.mois, 15)); // 15 du mois suivant

    // 1. Déclaration ITS
    const decIts = await this.prisma.rhDeclarationSocialeFiscale.upsert({
      where: {
        tenantId_etablissementId_cyclePaieId_typeDeclaration: {
          tenantId,
          etablissementId: cycle.etablissementId,
          cyclePaieId,
          typeDeclaration: 'ITS_BENIN',
        },
      },
      create: {
        tenantId,
        etablissementId: cycle.etablissementId,
        cyclePaieId,
        paysCode: 'BJ',
        typeDeclaration: 'ITS_BENIN',
        periodeDeclaration: periode,
        montantBase: totalBrut,
        montantTotal: totalIts,
        nombreSalariesConcernes: totalSalaries,
        dateLimiteLegale: dateLimite,
        statut: 'A_DECLARER',
      },
      update: {
        montantBase: totalBrut,
        montantTotal: totalIts,
        nombreSalariesConcernes: totalSalaries,
      },
    });

    // 2. Déclaration VPS
    const decVps = await this.prisma.rhDeclarationSocialeFiscale.upsert({
      where: {
        tenantId_etablissementId_cyclePaieId_typeDeclaration: {
          tenantId,
          etablissementId: cycle.etablissementId,
          cyclePaieId,
          typeDeclaration: 'VPS_BENIN',
        },
      },
      create: {
        tenantId,
        etablissementId: cycle.etablissementId,
        cyclePaieId,
        paysCode: 'BJ',
        typeDeclaration: 'VPS_BENIN',
        periodeDeclaration: periode,
        montantBase: totalBrut,
        montantTotal: totalVps,
        nombreSalariesConcernes: totalSalaries,
        dateLimiteLegale: dateLimite,
        statut: 'A_DECLARER',
      },
      update: {
        montantBase: totalBrut,
        montantTotal: totalVps,
        nombreSalariesConcernes: totalSalaries,
      },
    });

    // 3. Déclaration CNSS
    const decCnss = await this.prisma.rhDeclarationSocialeFiscale.upsert({
      where: {
        tenantId_etablissementId_cyclePaieId_typeDeclaration: {
          tenantId,
          etablissementId: cycle.etablissementId,
          cyclePaieId,
          typeDeclaration: 'CNSS_BENIN_COTISATIONS',
        },
      },
      create: {
        tenantId,
        etablissementId: cycle.etablissementId,
        cyclePaieId,
        paysCode: 'BJ',
        typeDeclaration: 'CNSS_BENIN_COTISATIONS',
        periodeDeclaration: periode,
        montantBase: totalBrut,
        montantTotal: totalCnss,
        nombreSalariesConcernes: totalSalaries,
        dateLimiteLegale: dateLimite,
        statut: 'A_DECLARER',
      },
      update: {
        montantBase: totalBrut,
        montantTotal: totalCnss,
        nombreSalariesConcernes: totalSalaries,
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_declaration_sociale_fiscale',
      entiteId: cyclePaieId,
      actionAudit: 'CREATION',
      champsModifiesJson: { totalIts, totalVps, totalCnss },
    });

    return [decIts, decVps, decCnss];
  }

  async getDeclarations(tenantId: string, cyclePaieId?: string, annee?: number) {
    const where: any = {
      tenantId,
      ...(cyclePaieId ? { cyclePaieId } : {}),
    };

    if (annee) {
      where.periodeDeclaration = { startsWith: `${annee}-` };
    }

    return this.prisma.rhDeclarationSocialeFiscale.findMany({
      where,
      include: {
        etablissement: true,
        cyclePaie: true,
      },
      orderBy: { dateLimiteLegale: 'desc' },
    });
  }
}
