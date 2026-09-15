import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateExerciceFiscalDto,
  CreateRetraitementDto,
  SimulerCalculIsDto,
} from '../dto/fiscalite.dto';

@Injectable()
export class ImpotSocietesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // EXERCICES FISCAUX
  // ----------------------------------------------------

  async getExercices(taxContribuableId: string) {
    return (this.prisma as any).taxExerciceFiscal.findMany({
      where: { taxContribuableId, isDeleted: false },
      include: {
        calculIs: true,
        retraitements: true,
        acomptesIs: { orderBy: { numeroAcompte: 'asc' } },
        liasseFiscale: true,
      },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async createExercice(dto: CreateExerciceFiscalDto) {
    const existing = await (this.prisma as any).taxExerciceFiscal.findFirst({
      where: {
        taxContribuableId: dto.taxContribuableId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        isDeleted: false,
      },
    });
    if (existing) {
      throw new BadRequestException('Un exercice fiscal existe déjà sur cette période.');
    }

    const exercice = await (this.prisma as any).taxExerciceFiscal.create({
      data: {
        taxContribuableId: dto.taxContribuableId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        exerciceComptableRefId: dto.exerciceComptableRefId,
        statut: 'OUVERT',
      },
    });

    // Générer automatiquement les 4 acomptes trimestriels pour l'exercice (Art. 50-51 CGI Bénin)
    const annee = new Date(dto.dateDebut).getFullYear();
    const datesAcomptes = [
      new Date(`${annee}-03-10`),
      new Date(`${annee}-06-10`),
      new Date(`${annee}-09-10`),
      new Date(`${annee}-12-10`),
    ];

    for (let i = 0; i < 4; i++) {
      await (this.prisma as any).taxAcompteIs.create({
        data: {
          taxExerciceFiscalId: exercice.id,
          numeroAcompte: i + 1,
          dateEcheance: datesAcomptes[i],
          montantDu: 0,
          statut: 'A_PAYER',
        },
      });
    }

    return this.getExerciceById(exercice.id);
  }

  async getExerciceById(id: string) {
    const exercice = await (this.prisma as any).taxExerciceFiscal.findUnique({
      where: { id },
      include: {
        contribuable: true,
        calculIs: true,
        retraitements: true,
        acomptesIs: { orderBy: { numeroAcompte: 'asc' } },
        liasseFiscale: true,
      },
    });
    if (!exercice) {
      throw new NotFoundException('Exercice fiscal introuvable.');
    }
    return exercice;
  }

  // ----------------------------------------------------
  // RETRAITEMENTS FISCAUX (RÉINTÉGRATIONS & DÉDUCTIONS)
  // ----------------------------------------------------

  async addRetraitement(exerciceId: string, dto: CreateRetraitementDto) {
    const ex = await this.getExerciceById(exerciceId);
    if (ex.statut === 'CLOTURE') {
      throw new BadRequestException('Impossible d’ajouter un retraitement sur un exercice clôturé.');
    }

    const retraitement = await (this.prisma as any).taxRetraitementFiscal.create({
      data: {
        taxExerciceFiscalId: exerciceId,
        sens: dto.sens,
        libelle: dto.libelle,
        montant: dto.montant,
        baseLegale: dto.baseLegale,
      },
    });

    return retraitement;
  }

  async deleteRetraitement(id: string) {
    return (this.prisma as any).taxRetraitementFiscal.delete({
      where: { id },
    });
  }

  // ----------------------------------------------------
  // MOTEUR DE SIMULATION ET DE CALCUL DE L'IS (EF-016)
  // ----------------------------------------------------

  simulerCalcul(dto: SimulerCalculIsDto) {
    // Taux d'IS selon le secteur (CGI 2026 Art. 46) :
    // 25% industrie / écoles privées, 30% autres personnes morales
    const isIndustriel = dto.secteurActivite?.toLowerCase().includes('indus') ||
      dto.secteurActivite?.toLowerCase().includes('ecole');
    const tauxIs = isIndustriel ? 25.0 : 30.0;

    // Résultat fiscal = Résultat comptable + Réintégrations - Déductions
    const resultatFiscal = Math.max(0, dto.resultatComptableNet + dto.reintegrations - dto.deductions);
    const isCalculeTaux = Math.round((resultatFiscal * (tauxIs / 100)) * 100) / 100;

    // Taux du minimum de perception (CGI 2026 Art. 47) :
    // 10% immobilier, 3% BTP, 1% autres
    let tauxMinimum = 1.0;
    if (dto.secteurActivite?.toLowerCase().includes('immo')) {
      tauxMinimum = 10.0;
    } else if (dto.secteurActivite?.toLowerCase().includes('btp') || dto.secteurActivite?.toLowerCase().includes('batiment')) {
      tauxMinimum = 3.0;
    }

    // Minimum de perception assis sur les produits encaissables, avec plancher absolu à 250 000 FCFA
    const montantMinBrut = (dto.produitsEncaissables || 0) * (tauxMinimum / 100);
    const minimumPerceptionMontant = Math.max(250000, Math.round(montantMinBrut * 100) / 100);

    // Règle EF-016 : IS dû = MAX(isCalculeTaux, minimumPerceptionMontant)
    const isDu = Math.max(isCalculeTaux, minimumPerceptionMontant);
    const montantAcompte = Math.round((isDu / 4) * 100) / 100;

    return {
      resultatComptableNet: dto.resultatComptableNet,
      reintegrations: dto.reintegrations,
      deductions: dto.deductions,
      resultatFiscal,
      tauxIsApplique: tauxIs,
      isCalculeTaux,
      produitsEncaissables: dto.produitsEncaissables,
      minimumPerceptionTaux: tauxMinimum,
      minimumPerceptionMontant,
      plancherAbsoluApplique: minimumPerceptionMontant === 250000 && montantMinBrut < 250000,
      isDu,
      regleRetenue: isCalculeTaux >= minimumPerceptionMontant ? 'CALCUL_AU_TAUX' : 'MINIMUM_DE_PERCEPTION',
      montantChaqueAcompte: montantAcompte,
    };
  }

  /**
   * Calcul officiel pour un exercice existant avec sauvegarde des résultats
   */
  async calculerEtEnregistrer(
    exerciceId: string,
    resultatComptableNet: number,
    produitsEncaissables: number,
    userId?: string,
  ) {
    const ex = await this.getExerciceById(exerciceId);

    // Récupérer les retraitements saisis
    const retraitements = await (this.prisma as any).taxRetraitementFiscal.findMany({
      where: { taxExerciceFiscalId: exerciceId },
    });

    const totalReintegrations = retraitements
      .filter((r: any) => r.sens === 'REINTEGRATION')
      .reduce((sum: number, r: any) => sum + r.montant, 0);

    const totalDeductions = retraitements
      .filter((r: any) => r.sens === 'DEDUCTION')
      .reduce((sum: number, r: any) => sum + r.montant, 0);

    const simulation = this.simulerCalcul({
      resultatComptableNet,
      reintegrations: totalReintegrations,
      deductions: totalDeductions,
      produitsEncaissables,
      secteurActivite: ex.contribuable?.secteurActivite || 'autres',
    });

    // Total des acomptes déjà versés
    const totalAcomptesVerses = ex.acomptesIs.reduce(
      (sum: number, a: any) => sum + (a.montantPaye || 0),
      0,
    );
    const soldeAPayer = Math.max(0, simulation.isDu - totalAcomptesVerses);

    // Enregistrer dans tax_calcul_is
    const calcul = await (this.prisma as any).taxCalculIs.upsert({
      where: { taxExerciceFiscalId: exerciceId },
      update: {
        resultatComptableNet,
        totalReintegrations,
        totalDeductions,
        resultatFiscal: simulation.resultatFiscal,
        tauxIsApplique: simulation.tauxIsApplique,
        isCalculeTaux: simulation.isCalculeTaux,
        produitsEncaissables,
        minimumPerceptionTaux: simulation.minimumPerceptionTaux,
        minimumPerceptionMontant: simulation.minimumPerceptionMontant,
        isDu: simulation.isDu,
        totalAcomptesVerses,
        soldeAPayer,
        statut: 'BROUILLON',
      },
      create: {
        taxExerciceFiscalId: exerciceId,
        resultatComptableNet,
        totalReintegrations,
        totalDeductions,
        resultatFiscal: simulation.resultatFiscal,
        tauxIsApplique: simulation.tauxIsApplique,
        isCalculeTaux: simulation.isCalculeTaux,
        produitsEncaissables,
        minimumPerceptionTaux: simulation.minimumPerceptionTaux,
        minimumPerceptionMontant: simulation.minimumPerceptionMontant,
        isDu: simulation.isDu,
        totalAcomptesVerses,
        soldeAPayer,
        statut: 'BROUILLON',
      },
    });

    // Mettre à jour le montant des 4 acomptes prévisionnels de l'année suivante
    for (let i = 1; i <= 4; i++) {
      await (this.prisma as any).taxAcompteIs.updateMany({
        where: { taxExerciceFiscalId: exerciceId, numeroAcompte: i },
        data: { montantDu: simulation.montantChaqueAcompte },
      });
    }

    // Traçabilité de consultation comptable (EF-044)
    await (this.prisma as any).taxSoldeComptableConsulte.create({
      data: {
        taxExerciceFiscalId: exerciceId,
        compteSyscohadaConsulte: '131 / Résultat Net',
        soldeLu: resultatComptableNet,
        exerciceComptableStatutALaLecture: 'CLOTURE',
      },
    });

    return this.getExerciceById(exerciceId);
  }

  /**
   * Règle EF-045 : Validation de l'IS et génération de l'écriture retour vers M3 (695 / 444)
   */
  async validerEtGenererEcritureM3(exerciceId: string, validatorUserId: string) {
    const ex = await this.getExerciceById(exerciceId);
    if (!ex.calculIs) {
      throw new BadRequestException('Aucun calcul d’IS n’a été réalisé sur cet exercice.');
    }

    // Mettre à jour statut
    await (this.prisma as any).taxCalculIs.update({
      where: { taxExerciceFiscalId: exerciceId },
      data: {
        statut: 'VALIDE',
        valideParUtilisateurId: validatorUserId,
      },
    });

    // Créer l'écriture comptable fiscale (EF-045) :
    // Débit 695 Impôt sur le résultat / Crédit 444 État, impôts sur les bénéfices
    const ecriture = await (this.prisma as any).taxEcritureComptableFiscale.create({
      data: {
        taxContribuableId: ex.taxContribuableId,
        objetSourceType: 'tax_calcul_is',
        objetSourceId: ex.calculIs.id,
        dateEcriture: ex.dateFin,
        compteDebitSyscohada: '695',
        compteCreditSyscohada: '444',
        montant: ex.calculIs.isDu,
        statut: 'GENEREE',
      },
    });

    return {
      message: 'Calcul IS validé et écriture comptable 695/444 générée avec succès.',
      ecriture,
      isDu: ex.calculIs.isDu,
    };
  }

  async payerAcompte(acompteId: string, montant: number) {
    const acompte = await (this.prisma as any).taxAcompteIs.findUnique({
      where: { id: acompteId },
    });
    if (!acompte) {
      throw new NotFoundException('Acompte introuvable.');
    }

    const montantPayeTotal = (acompte.montantPaye || 0) + montant;
    const estSolde = montantPayeTotal >= acompte.montantDu;

    return (this.prisma as any).taxAcompteIs.update({
      where: { id: acompteId },
      data: {
        montantPaye: montantPayeTotal,
        statut: estSolde ? 'PAYE' : 'A_PAYER',
      },
    });
  }
}
