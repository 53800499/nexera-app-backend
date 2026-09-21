import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';

/**
 * SERVICE D'INTERFACES COMPTABLES & DÉCLARATIONS FISCALES
 * 
 * 1. Interface Comptable SYSCOHADA (M3) :
 *    - Écriture d'Opérations Diverses (OD) dynamique basée sur le paramétrage des rubriques (RhRubriquePaie) :
 *      * Débit (Charges classe 6) : compteComptableCharge paramétré sur chaque rubrique de gain ou charge patronale
 *      * Crédit (Dettes classes 42, 43, 44) : compteComptableTiers paramétré sur chaque rubrique de retenue, dette sociale/fiscale et net à payer
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
   * Génère l'écriture d'Opérations Diverses (OD) de paie équilibrée selon le plan SYSCOHADA
   * en s'appuyant dynamiquement sur les rubriques paramétrées dans le référentiel (RhRubriquePaie).
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

    // 1. Récupération des rubriques configurées dans le référentiel pour le pays de l'établissement
    const paysCode = cycle.etablissement?.paysCode;
    if (!paysCode) {
      throw new BadRequestException(
        `L'établissement rattaché à ce cycle n'a aucun pays configuré. Veuillez renseigner le pays de l'établissement dans les paramètres d'organisation.`,
      );
    }
    const rubriquesCatalogue = await this.prisma.rhRubriquePaie.findMany({
      where: { paysCode },
      orderBy: { ordreAffichage: 'asc' },
    });

    if (rubriquesCatalogue.length === 0) {
      throw new BadRequestException(
        `Aucune rubrique de paie n'est configurée en base pour le pays "${paysCode}". Veuillez configurer le catalogue des rubriques dans les Paramètres RH.`,
      );
    }

    const rubriqueMap = new Map<string, (typeof rubriquesCatalogue)[0]>();
    for (const r of rubriquesCatalogue) {
      rubriqueMap.set(r.code, r);
    }

    // Rubrique du Net à Payer (définie en base par le code 'R900' ou le type 'GAIN_NET_NON_IMPOSABLE')
    const rubNet = rubriquesCatalogue.find(
      (r) => r.code === 'R900' || r.typeRubrique === 'GAIN_NET_NON_IMPOSABLE',
    );
    if (!rubNet?.compteComptableTiers) {
      throw new BadRequestException(
        `Le compte comptable de tiers pour le Net à Payer (rubrique "${rubNet?.code || 'R900'}") n'est pas configuré en base dans les paramètres des rubriques de paie.`,
      );
    }
    const compteNetAPayer = rubNet.compteComptableTiers;

    const refCycle = cycle.codeCycle;

    // Structures intermédiaires pour agréger les écritures comptables
    type LigneCumul = {
      sens: 'DEBIT' | 'CREDIT';
      compteNumero: string;
      libelle: string;
      rubriquePaieId?: string | null;
      montant: number;
      ordre: number;
    };

    const debitsMap = new Map<string, LigneCumul>();
    const creditsMap = new Map<string, LigneCumul>();

    const addDebit = (
      compte: string,
      libelle: string,
      montant: number,
      rubriqueId?: string | null,
      ordre = 100,
    ) => {
      if (montant <= 0) return;
      const key = `${compte}_${rubriqueId || libelle}`;
      const existing = debitsMap.get(key);
      if (existing) {
        existing.montant += montant;
      } else {
        debitsMap.set(key, {
          sens: 'DEBIT',
          compteNumero: compte,
          libelle,
          rubriquePaieId: rubriqueId || null,
          montant,
          ordre,
        });
      }
    };

    const addCredit = (
      compte: string,
      libelle: string,
      montant: number,
      rubriqueId?: string | null,
      ordre = 100,
    ) => {
      if (montant <= 0) return;
      const key = `${compte}_${rubriqueId || libelle}`;
      const existing = creditsMap.get(key);
      if (existing) {
        existing.montant += montant;
      } else {
        creditsMap.set(key, {
          sens: 'CREDIT',
          compteNumero: compte,
          libelle,
          rubriquePaieId: rubriqueId || null,
          montant,
          ordre,
        });
      }
    };

    const hasDetailedLines = cycle.bulletinsPaie.some(
      (b) => b.lignes && b.lignes.length > 0,
    );

    if (hasDetailedLines) {
      // MODE DYNAMIQUE : Parcours des lignes réelles de tous les bulletins
      for (const b of cycle.bulletinsPaie) {
        for (const l of b.lignes) {
          const rub = rubriqueMap.get(l.codeRubrique);
          if (!rub) {
            throw new BadRequestException(
              `La rubrique "${l.codeRubrique}" (${l.libelleRubrique}) utilisée dans le bulletin n'a pas été trouvée dans le paramétrage des rubriques en base.`,
            );
          }

          const rubId = rub.id;
          const libelleBase = rub.libelle || l.libelleRubrique;
          const isNet = rub.code === 'R900' || rub.typeRubrique === 'GAIN_NET_NON_IMPOSABLE';

          // A. Gains bruts & avantages (Charges de personnel au Débit via compteComptableCharge configuré en base)
          if (
            !isNet &&
            (l.sens === 'GAIN' ||
              ['GAIN_BRUT', 'AVANTAGE_EN_NATURE', 'INDEMNITE_NON_IMPOSABLE'].includes(l.typeRubrique))
          ) {
            if (l.montantGain > 0) {
              if (!rub.compteComptableCharge) {
                throw new BadRequestException(
                  `Le compte comptable de charge (Débit) n'est pas configuré en base pour la rubrique "${rub.code} - ${rub.libelle}". Veuillez le renseigner dans les Paramètres RH.`,
                );
              }
              addDebit(
                rub.compteComptableCharge,
                `${libelleBase} • ${refCycle}`,
                l.montantGain,
                rubId,
                rub.ordreAffichage ?? l.ordre,
              );
            }
          }

          // B. Charges patronales (Débit Charge via compteComptableCharge & Crédit Dette via compteComptableTiers)
          if (
            l.partPatronaleMontant > 0 ||
            ['CHARGE_PATRONALE_CNSS', 'CHARGE_PATRONALE_VPS', 'CHARGE_PATRONALE_AUTRE'].includes(l.typeRubrique)
          ) {
            if (l.partPatronaleMontant > 0) {
              if (!rub.compteComptableCharge) {
                throw new BadRequestException(
                  `Le compte comptable de charge (Débit) n'est pas configuré en base pour la charge patronale "${rub.code} - ${rub.libelle}".`,
                );
              }
              if (!rub.compteComptableTiers) {
                throw new BadRequestException(
                  `Le compte comptable de tiers créancier (Crédit) n'est pas configuré en base pour la charge patronale "${rub.code} - ${rub.libelle}".`,
                );
              }

              addDebit(
                rub.compteComptableCharge,
                `${libelleBase} (Part Patronale) • ${refCycle}`,
                l.partPatronaleMontant,
                rubId,
                rub.ordreAffichage ?? l.ordre,
              );
              addCredit(
                rub.compteComptableTiers,
                `${libelleBase} (Cotisations Dues) • ${refCycle}`,
                l.partPatronaleMontant,
                rubId,
                rub.ordreAffichage ?? l.ordre,
              );
            }
          }

          // C. Retenues salariales (Crédit Dettes via compteComptableTiers configuré en base)
          if (
            l.sens === 'RETENUE' ||
            ['RETENUE_SALARIALE_CNSS', 'RETENUE_FISCALE_ITS', 'RETENUE_NETTE_AUTRE'].includes(l.typeRubrique)
          ) {
            if (l.montantRetenue > 0) {
              if (!rub.compteComptableTiers) {
                throw new BadRequestException(
                  `Le compte comptable de tiers (Crédit) n'est pas configuré en base pour la retenue "${rub.code} - ${rub.libelle}".`,
                );
              }
              addCredit(
                rub.compteComptableTiers,
                `${libelleBase} (Retenue Salariale) • ${refCycle}`,
                l.montantRetenue,
                rubId,
                rub.ordreAffichage ?? l.ordre,
              );
            }
          }
        }
      }

      // D. Net à payer global dû aux salariés (Crédit compte personnel issu de la base)
      const totalNet = cycle.bulletinsPaie.reduce((sum, b) => sum + (b.netAPayer || 0), 0);
      if (totalNet > 0) {
        addCredit(
          compteNetAPayer,
          `${rubNet.libelle} (Net à Régler) • ${refCycle}`,
          totalNet,
          rubNet.id,
          rubNet.ordreAffichage ?? 999,
        );
      }
    } else {
      // MODE REPLI : Tous les comptes proviennent strictement de la base de données
      const getRequiredChargeAccount = (code: string): { compte: string; rub: (typeof rubriquesCatalogue)[0] } => {
        const rub = rubriqueMap.get(code);
        if (!rub) {
          throw new BadRequestException(`La rubrique "${code}" n'existe pas en base dans le catalogue des rubriques.`);
        }
        if (!rub.compteComptableCharge) {
          throw new BadRequestException(
            `Le compte comptable de charge pour la rubrique "${code} - ${rub.libelle}" n'est pas configuré en base dans les Paramètres RH.`,
          );
        }
        return { compte: rub.compteComptableCharge, rub };
      };

      const getRequiredTiersAccount = (code: string): { compte: string; rub: (typeof rubriquesCatalogue)[0] } => {
        const rub = rubriqueMap.get(code);
        if (!rub) {
          throw new BadRequestException(`La rubrique "${code}" n'existe pas en base dans le catalogue des rubriques.`);
        }
        if (!rub.compteComptableTiers) {
          throw new BadRequestException(
            `Le compte comptable de tiers pour la rubrique "${code} - ${rub.libelle}" n'est pas configuré en base dans les Paramètres RH.`,
          );
        }
        return { compte: rub.compteComptableTiers, rub };
      };

      let totalBase = 0;
      let totalHS = 0;
      let totalPrimes = 0;
      let totalAvantages = 0;
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

      if (totalBase + totalHS > 0) {
        const { compte, rub } = getRequiredChargeAccount('R100');
        addDebit(
          compte,
          `${rub.libelle} & Heures Sup • ${refCycle}`,
          totalBase + totalHS,
          rub.id,
          rub.ordreAffichage,
        );
      }
      if (totalPrimes > 0) {
        const { compte, rub } = getRequiredChargeAccount('R150');
        addDebit(
          compte,
          `${rub.libelle} • ${refCycle}`,
          totalPrimes,
          rub.id,
          rub.ordreAffichage,
        );
      }
      if (totalAvantages > 0) {
        const { compte, rub } = getRequiredChargeAccount('R300');
        addDebit(
          compte,
          `${rub.libelle} • ${refCycle}`,
          totalAvantages,
          rub.id,
          rub.ordreAffichage,
        );
      }
      if (totalCnssPatronale > 0) {
        const charge = getRequiredChargeAccount('R600');
        const tiers = getRequiredTiersAccount('R600');
        addDebit(
          charge.compte,
          `${charge.rub.libelle} (Part Patronale) • ${refCycle}`,
          totalCnssPatronale,
          charge.rub.id,
          charge.rub.ordreAffichage,
        );
        addCredit(
          tiers.compte,
          `${tiers.rub.libelle} (Cotisations Dues) • ${refCycle}`,
          totalCnssPatronale,
          tiers.rub.id,
          tiers.rub.ordreAffichage,
        );
      }
      if (totalVpsPatronale > 0) {
        const charge = getRequiredChargeAccount('R650');
        const tiers = getRequiredTiersAccount('R650');
        addDebit(
          charge.compte,
          `${charge.rub.libelle} (Part Patronale) • ${refCycle}`,
          totalVpsPatronale,
          charge.rub.id,
          charge.rub.ordreAffichage,
        );
        addCredit(
          tiers.compte,
          `${tiers.rub.libelle} (Taxes Dues) • ${refCycle}`,
          totalVpsPatronale,
          tiers.rub.id,
          tiers.rub.ordreAffichage,
        );
      }

      if (totalNetAPayer > 0) {
        addCredit(
          compteNetAPayer,
          `${rubNet.libelle} (Net à Régler) • ${refCycle}`,
          totalNetAPayer,
          rubNet.id,
          rubNet.ordreAffichage ?? 999,
        );
      }
      if (totalCnssSalariale > 0) {
        const { compte, rub } = getRequiredTiersAccount('R500');
        addCredit(
          compte,
          `${rub.libelle} (Retenue Salariale) • ${refCycle}`,
          totalCnssSalariale,
          rub.id,
          rub.ordreAffichage,
        );
      }
      if (totalIts > 0) {
        const { compte, rub } = getRequiredTiersAccount('R550');
        addCredit(
          compte,
          `${rub.libelle} (Retenue Fiscale) • ${refCycle}`,
          totalIts,
          rub.id,
          rub.ordreAffichage,
        );
      }
      if (totalRetenuesDiverses > 0) {
        const { compte, rub } = getRequiredTiersAccount('R700');
        addCredit(
          compte,
          `${rub.libelle} (Retenue) • ${refCycle}`,
          totalRetenuesDiverses,
          rub.id,
          rub.ordreAffichage,
        );
      }
    }

    // Trier les Débits (par ordre d'affichage de la rubrique puis compteNumero)
    const sortedDebits = Array.from(debitsMap.values()).sort(
      (a, b) => a.ordre - b.ordre || a.compteNumero.localeCompare(b.compteNumero),
    );

    // Trier les Crédits (par ordre d'affichage de la rubrique puis compteNumero)
    const sortedCredits = Array.from(creditsMap.values()).sort(
      (a, b) => a.ordre - b.ordre || a.compteNumero.localeCompare(b.compteNumero),
    );

    let totalDebit = sortedDebits.reduce((sum, d) => sum + d.montant, 0);
    let totalCredit = sortedCredits.reduce((sum, c) => sum + c.montant, 0);

    // Équilibrage strict au franc près : ajustement résiduel éventuel d'arrondi sur la ligne Net à Payer
    const ecartArrondi = Math.round(totalDebit - totalCredit);
    if (ecartArrondi !== 0 && Math.abs(ecartArrondi) <= 10) {
      const netLine = sortedCredits.find((c) => c.compteNumero === compteNetAPayer);
      if (netLine) {
        netLine.montant += ecartArrondi;
        totalCredit += ecartArrondi;
      }
    }

    let lineNum = 1;
    const lignesData: Array<{
      numeroLigne: number;
      compteNumero: string;
      libelle: string;
      montantDebit: number;
      montantCredit: number;
      rubriquePaieId?: string | null;
    }> = [];

    for (const d of sortedDebits) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: d.compteNumero,
        libelle: d.libelle,
        montantDebit: Math.round(d.montant),
        montantCredit: 0,
        rubriquePaieId: d.rubriquePaieId,
      });
    }

    for (const c of sortedCredits) {
      lignesData.push({
        numeroLigne: lineNum++,
        compteNumero: c.compteNumero,
        libelle: c.libelle,
        montantDebit: 0,
        montantCredit: Math.round(c.montant),
        rubriquePaieId: c.rubriquePaieId,
      });
    }

    const finalDebit = lignesData.reduce((sum, l) => sum + l.montantDebit, 0);
    const finalCredit = lignesData.reduce((sum, l) => sum + l.montantCredit, 0);
    const estEquilibree = Math.abs(finalDebit - finalCredit) < 1;

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
        libellePiece: `OD Salaires & Charges - ${cycle.etablissement.raisonSociale} [${refCycle}]`,
        montantTotalDebit: finalDebit,
        montantTotalCredit: finalCredit,
        estEquilibree,
        statut: 'GENERE',
        lignes: {
          create: lignesData.map((l) => ({
            numeroLigne: l.numeroLigne,
            compteNumero: l.compteNumero,
            libelle: l.libelle,
            montantDebit: l.montantDebit,
            montantCredit: l.montantCredit,
            rubriquePaieId: l.rubriquePaieId || undefined,
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
      champsModifiesJson: { totalDebit: finalDebit, totalCredit: finalCredit, estEquilibree },
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

  /**
   * Construit la pièce d'écriture comptable d'OD pour un Solde de Tout Compte (STC)
   * selon le plan SYSCOHADA en s'appuyant dynamiquement sur les rubriques paramétrées en base.
   */
  async buildOdStc(stcId: string, tenantId: string) {
    const stc = await this.prisma.rhSoldeToutCompte.findFirst({
      where: { id: stcId, tenantId },
      include: {
        employe: {
          include: {
            affectations: {
              where: { estActuelle: true },
              include: { etablissement: true, departement: true },
            },
            contrats: {
              orderBy: { dateDebut: 'desc' },
              take: 1,
              include: { etablissement: true },
            },
          },
        },
        contratRupture: true,
      },
    });

    if (!stc) {
      throw new NotFoundException('Solde de tout compte introuvable');
    }

    const etablissement =
      stc.employe?.affectations[0]?.etablissement ||
      stc.employe?.contrats[0]?.etablissement;

    const paysCode = etablissement?.paysCode;
    if (!paysCode) {
      throw new BadRequestException(
        `L'établissement rattaché à l'employé (${stc.employe?.matricule} - ${stc.employe?.nom} ${stc.employe?.prenoms}) n'a aucun pays configuré.`,
      );
    }

    const rubriquesCatalogue = await this.prisma.rhRubriquePaie.findMany({
      where: { paysCode },
      orderBy: { ordreAffichage: 'asc' },
    });

    if (rubriquesCatalogue.length === 0) {
      throw new BadRequestException(
        `Aucune rubrique de paie n'est configurée en base pour le pays "${paysCode}". Veuillez configurer le catalogue des rubriques dans les Paramètres RH.`,
      );
    }

    const rubNet = rubriquesCatalogue.find(
      (r) => r.code === 'R900' || r.typeRubrique === 'GAIN_NET_NON_IMPOSABLE',
    );
    if (!rubNet?.compteComptableTiers) {
      throw new BadRequestException(
        `Le compte comptable de tiers pour le Net à Payer (rubrique "${rubNet?.code || 'R900'}") n'est pas configuré en base dans les Paramètres RH.`,
      );
    }

    const rubBase = rubriquesCatalogue.find(
      (r) => r.code === 'R100' || r.typeRubrique === 'GAIN_BRUT',
    );
    if (!rubBase?.compteComptableCharge) {
      throw new BadRequestException(
        `Le compte comptable de charge pour le salaire de base (rubrique "${rubBase?.code || 'R100'}") n'est pas configuré en base dans les Paramètres RH.`,
      );
    }

    const rubConges =
      rubriquesCatalogue.find(
        (r) => r.code === 'R130' || r.code.includes('CONGE') || r.libelle.toLowerCase().includes('congé'),
      ) || rubBase;

    const rubPreavis =
      rubriquesCatalogue.find(
        (r) => r.code === 'R135' || r.code.includes('PREAVIS') || r.libelle.toLowerCase().includes('préavis'),
      ) || rubBase;

    const rubLicenciement =
      rubriquesCatalogue.find(
        (r) =>
          r.code === 'R140' ||
          r.code.includes('LICENC') ||
          r.libelle.toLowerCase().includes('licenciement') ||
          r.libelle.toLowerCase().includes('rupture'),
      ) || rubBase;

    const rubRetenue = rubriquesCatalogue.find(
      (r) => r.code === 'R700' || r.sensDefaut === 'RETENUE',
    );
    const compteRetenue = rubRetenue?.compteComptableTiers || rubNet.compteComptableTiers;

    const empLabel = `${stc.employe.nom} ${stc.employe.prenoms} [${stc.employe.matricule}]`;

    type LigneOd = {
      numeroLigne: number;
      compteNumero: string;
      libelle: string;
      montantDebit: number;
      montantCredit: number;
      rubriquePaieId?: string | null;
    };

    const lignes: LigneOd[] = [];
    let lineNum = 1;

    // A. DÉBITS (Charges de rupture et salaire restant)
    if (stc.montantDernierSalaireNet > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: rubBase.compteComptableCharge!,
        libelle: `Dernier salaire net restant dû • ${empLabel}`,
        montantDebit: Math.round(stc.montantDernierSalaireNet),
        montantCredit: 0,
        rubriquePaieId: rubBase.id,
      });
    }

    if (stc.montantIndemniteCongesPayesNet > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: rubConges.compteComptableCharge || rubBase.compteComptableCharge!,
        libelle: `${rubConges.libelle} • ${empLabel}`,
        montantDebit: Math.round(stc.montantIndemniteCongesPayesNet),
        montantCredit: 0,
        rubriquePaieId: rubConges.id,
      });
    }

    if (stc.montantIndemnitePreavisNet > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: rubPreavis.compteComptableCharge || rubBase.compteComptableCharge!,
        libelle: `${rubPreavis.libelle} • ${empLabel}`,
        montantDebit: Math.round(stc.montantIndemnitePreavisNet),
        montantCredit: 0,
        rubriquePaieId: rubPreavis.id,
      });
    }

    if (stc.montantIndemniteLicenciementNet > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: rubLicenciement.compteComptableCharge || rubBase.compteComptableCharge!,
        libelle: `${rubLicenciement.libelle} • ${empLabel}`,
        montantDebit: Math.round(stc.montantIndemniteLicenciementNet),
        montantCredit: 0,
        rubriquePaieId: rubLicenciement.id,
      });
    }

    // B. CRÉDITS (Dettes envers le salarié & retenues diverses)
    if (stc.montantRetenuesDiverses > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: compteRetenue,
        libelle: `${rubRetenue?.libelle || 'Retenues diverses / Avances'} • ${empLabel}`,
        montantDebit: 0,
        montantCredit: Math.round(stc.montantRetenuesDiverses),
        rubriquePaieId: rubRetenue?.id || null,
      });
    }

    if (stc.montantTotalNet > 0) {
      lignes.push({
        numeroLigne: lineNum++,
        compteNumero: rubNet.compteComptableTiers!,
        libelle: `${rubNet.libelle} (Net STC à Régler) • ${empLabel}`,
        montantDebit: 0,
        montantCredit: Math.round(stc.montantTotalNet),
        rubriquePaieId: rubNet.id,
      });
    }

    const totalDebit = lignes.reduce((s, l) => s + l.montantDebit, 0);
    const totalCredit = lignes.reduce((s, l) => s + l.montantCredit, 0);
    const estEquilibree = Math.abs(totalDebit - totalCredit) < 1;

    return {
      id: `OD-STC-${stc.id}`,
      stcId: stc.id,
      dateEcriture: stc.dateEtablissement,
      journalCode: 'OD',
      libellePiece: `OD Solde de Tout Compte - ${empLabel}`,
      montantTotalDebit: totalDebit,
      montantTotalCredit: totalCredit,
      estEquilibree,
      statut: 'GENERE',
      etablissement,
      employe: stc.employe,
      lignes,
    };
  }

  /**
   * Consulter le projet d'écriture d'Opérations Diverses (OD) d'un Solde de Tout Compte (STC)
   */
  async getOdStc(stcId: string, tenantId: string) {
    return this.buildOdStc(stcId, tenantId);
  }

  /**
   * Générer et enregistrer l'audit de l'OD de Solde de Tout Compte (STC)
   */
  async generateOdStc(stcId: string, tenantId: string, userId?: string) {
    const od = await this.buildOdStc(stcId, tenantId);

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_solde_tout_compte_od',
      entiteId: stcId,
      actionAudit: 'CREATION',
      champsModifiesJson: {
        totalDebit: od.montantTotalDebit,
        totalCredit: od.montantTotalCredit,
        estEquilibree: od.estEquilibree,
        lignesCount: od.lignes.length,
      },
    });

    return od;
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

    const paysCode = cycle.etablissement?.paysCode;
    if (!paysCode) {
      throw new BadRequestException("L'établissement associé au cycle n'a aucun pays configuré.");
    }
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
        paysCode,
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
        paysCode,
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
        paysCode,
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
