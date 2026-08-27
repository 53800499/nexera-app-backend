import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AnomaliesEngineService } from '../intelligence-artificielle/anomalies-engine.service';
import {
  CreateRapportFraisDto,
  RejeterRapportDto,
  UpdateRapportFraisDto,
  ValiderRapportDto,
} from '../dto/rapports-frais.dto';

@Injectable()
export class RapportsFraisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anomaliesEngine: AnomaliesEngineService,
  ) {}

  async getRapports(
    tenantId: string,
    params?: {
      employeRefId?: string;
      statut?: any;
    },
  ) {
    const where: any = { tenantId, isDeleted: false };
    if (params?.employeRefId) where.employeRefId = params.employeRefId;
    if (params?.statut) where.statut = params.statut;

    return this.prisma.ndfRapportFrais.findMany({
      where,
      include: {
        employe: {
          select: {
            id: true,
            matricule: true,
            nom: true,
            prenoms: true,
          },
        },
        mission: true,
        avanceFrais: true,
        depenses: {
          where: { isDeleted: false },
          include: { categorieDepense: true, justificatifs: true },
        },
        anomalies: {
          where: { isDeleted: false },
          include: { regleDetection: true },
        },
        etapesValidation: {
          where: { isDeleted: false },
          orderBy: { ordre: 'asc' },
        },
        remboursement: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRapportById(tenantId: string, id: string) {
    const rapport = await this.prisma.ndfRapportFrais.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        employe: {
          select: {
            id: true,
            matricule: true,
            nom: true,
            prenoms: true,
            emailProfessionnel: true,
          },
        },
        mission: true,
        avanceFrais: true,
        depenses: {
          where: { isDeleted: false },
          include: {
            categorieDepense: true,
            depenseKilometrique: { include: { baremeKilometrique: true } },
            depensePerDiem: { include: { baremePerDiem: true } },
            justificatifs: { include: { extractionsIa: true } },
            anomalies: { include: { regleDetection: true } },
          },
        },
        anomalies: {
          where: { isDeleted: false },
          include: { regleDetection: true },
        },
        etapesValidation: {
          where: { isDeleted: false },
          orderBy: { ordre: 'asc' },
        },
        historiqueStatuts: {
          where: { isDeleted: false },
          orderBy: { dateChangement: 'asc' },
        },
        remboursement: true,
        ecrituresComptables: {
          where: { isDeleted: false },
          include: { lignes: true },
        },
      },
    });

    if (!rapport) {
      throw new NotFoundException(`Rapport de frais #${id} introuvable`);
    }

    return rapport;
  }

  async createRapport(tenantId: string, dto: CreateRapportFraisDto) {
    // 1. Vérifier l'employé
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: dto.employeRefId, tenantId, isDeleted: false },
    });

    if (!employe) {
      throw new NotFoundException(`Salarié #${dto.employeRefId} introuvable`);
    }

    // 2. Génération numéro séquentiel unique NDF-YYYYMM-XXXX
    const count = await this.prisma.ndfRapportFrais.count({ where: { tenantId } });
    const monthStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = String(count + 1).padStart(4, '0');
    const numeroRapport = `NDF-${monthStr}-${seq}`;

    // 3. Création
    const rapport = await this.prisma.ndfRapportFrais.create({
      data: {
        tenantId,
        employeRefId: dto.employeRefId,
        missionId: dto.missionId || null,
        numeroRapport,
        objet: dto.objet,
        periodeDebut: new Date(dto.periodeDebut),
        periodeFin: new Date(dto.periodeFin),
        montantTotal: 0,
        montantTvaRecuperableTotal: 0,
        avanceFraisId: dto.avanceFraisId || null,
        statut: 'BROUILLON',
      },
    });

    // Journaliser statut initial
    await this.prisma.ndfHistoriqueStatut.create({
      data: {
        ndfRapportFraisId: rapport.id,
        ancienStatut: null,
        nouveauStatut: 'BROUILLON',
        commentaire: 'Création de la note de frais',
      },
    });

    return this.getRapportById(tenantId, rapport.id);
  }

  async updateRapport(tenantId: string, id: string, dto: UpdateRapportFraisDto) {
    const rapport = await this.getRapportById(tenantId, id);

    if (rapport.statut !== 'BROUILLON' && rapport.statut !== 'REJETE') {
      throw new BadRequestException(
        `Modification interdite sur un rapport avec statut ${rapport.statut}`,
      );
    }

    return this.prisma.ndfRapportFrais.update({
      where: { id: rapport.id },
      data: {
        objet: dto.objet ?? rapport.objet,
        periodeDebut: dto.periodeDebut ? new Date(dto.periodeDebut) : rapport.periodeDebut,
        periodeFin: dto.periodeFin ? new Date(dto.periodeFin) : rapport.periodeFin,
        missionId: dto.missionId ?? rapport.missionId,
        avanceFraisId: dto.avanceFraisId ?? rapport.avanceFraisId,
      },
    });
  }

  /**
   * Soumettre un rapport de frais à la validation manager
   */
  async soumettreRapport(tenantId: string, id: string, utilisateurId: string) {
    const rapport = await this.getRapportById(tenantId, id);

    if (rapport.depenses.length === 0) {
      throw new BadRequestException(
        'Impossible de soumettre une note de frais sans aucune dépense',
      );
    }

    if (rapport.statut !== 'BROUILLON' && rapport.statut !== 'REJETE') {
      throw new BadRequestException(
        `Le rapport #${id} est déjà au statut ${rapport.statut}`,
      );
    }

    // 1. Lancer l'analyse automatique par le moteur d'anomalies
    await this.anomaliesEngine.analyserRapportFrais(tenantId, id);

    // 2. Créer l'étape de validation (Circuit standard : 1 étape manager)
    await this.prisma.ndfEtapeValidation.deleteMany({
      where: { ndfRapportFraisId: id },
    });

    await this.prisma.ndfEtapeValidation.create({
      data: {
        ndfRapportFraisId: id,
        ordre: 1,
        valideurUtilisateurId: utilisateurId, // assigné au manager
        statut: 'EN_ATTENTE',
      },
    });

    // 3. Mettre à jour le statut
    await this.prisma.ndfRapportFrais.update({
      where: { id },
      data: { statut: 'EN_VALIDATION' },
    });

    await this.prisma.ndfHistoriqueStatut.create({
      data: {
        ndfRapportFraisId: id,
        ancienStatut: rapport.statut,
        nouveauStatut: 'EN_VALIDATION',
        utilisateurId,
        commentaire: 'Soumission pour validation manager',
      },
    });

    return this.getRapportById(tenantId, id);
  }

  /**
   * Approuver un rapport de frais (Génère l'OD comptable d'engagement et le paiement)
   */
  async validerRapport(
    tenantId: string,
    id: string,
    valideurId: string,
    dto: ValiderRapportDto,
  ) {
    const rapport = await this.getRapportById(tenantId, id);

    if (rapport.statut !== 'EN_VALIDATION' && rapport.statut !== 'SOUMIS') {
      throw new BadRequestException(
        `Seul un rapport en cours de validation peut être approuvé (Statut actuel: ${rapport.statut})`,
      );
    }

    // 1. Mettre à jour l'étape de validation
    await this.prisma.ndfEtapeValidation.updateMany({
      where: { ndfRapportFraisId: id, statut: 'EN_ATTENTE' },
      data: {
        statut: 'APPROUVEE',
        dateDecision: new Date(),
        commentaire: dto.commentaire || 'Approuvé par le manager',
      },
    });

    // 2. Mettre à jour le statut du rapport et de toutes ses dépenses
    await this.prisma.ndfRapportFrais.update({
      where: { id },
      data: { statut: 'VALIDE' },
    });

    await this.prisma.ndfDepense.updateMany({
      where: { ndfRapportFraisId: id },
      data: { statut: 'VALIDEE' },
    });

    // 3. Journaliser le changement de statut
    await this.prisma.ndfHistoriqueStatut.create({
      data: {
        ndfRapportFraisId: id,
        ancienStatut: rapport.statut,
        nouveauStatut: 'VALIDE',
        utilisateurId: valideurId,
        commentaire: dto.commentaire || 'Approbation finale du rapport',
      },
    });

    // 4. Parallélisme M3 : Générer l'écriture comptable d'engagement (EF-023)
    const ecriture = await this.prisma.ndfEcritureComptable.create({
      data: {
        tenantId,
        ndfRapportFraisId: id,
        typeEcriture: 'ENGAGEMENT_DEPENSE',
        dateEcriture: new Date(),
        montantTotalDebit: rapport.montantTotal,
        montantTotalCredit: rapport.montantTotal,
        statut: 'GENEREE',
      },
    });

    // Lignes de charges par catégorie (SYSCOHADA Classe 6)
    for (const dep of rapport.depenses) {
      const montantHt = dep.montantDeviseReference - (dep.montantTva || 0);
      await this.prisma.ndfEcritureComptableLigne.create({
        data: {
          ndfEcritureComptableId: ecriture.id,
          compteSyscohada: dep.categorieDepense.compteSyscohadaDefaut || '6251',
          libelle: `${dep.categorieDepense.libelle} - ${dep.fournisseurLibelle || 'Frais'}`,
          sens: 'DEBIT',
          montant: montantHt,
        },
      });

      // Ligne TVA déductible (4452)
      if (dep.montantTva && dep.montantTva > 0) {
        await this.prisma.ndfEcritureComptableLigne.create({
          data: {
            ndfEcritureComptableId: ecriture.id,
            compteSyscohada: '4452',
            libelle: `TVA déductible sur note de frais - ${dep.fournisseurLibelle || ''}`,
            sens: 'DEBIT',
            montant: dep.montantTva,
          },
        });

        // Parallélisme M7 : Transmettre l'événement fiscal TVA (EF-026)
        await this.prisma.ndfEvenementFiscalTransmis.upsert({
          where: { ndfDepenseId: dep.id },
          create: {
            ndfDepenseId: dep.id,
            statut: 'TRANSMIS',
          },
          update: {
            statut: 'TRANSMIS',
          },
        });
      }
    }

    // Ligne Crédit Compte de tiers Salarié (421)
    await this.prisma.ndfEcritureComptableLigne.create({
      data: {
        ndfEcritureComptableId: ecriture.id,
        compteSyscohada: '4211',
        libelle: `Remboursement note de frais ${rapport.numeroRapport} - ${rapport.employe.nom} ${rapport.employe.prenoms}`,
        sens: 'CREDIT',
        montant: rapport.montantTotal,
      },
    });

    // 5. Initialiser l'ordre de remboursement (EF-021)
    const montantNetRembourser = Math.max(
      0,
      rapport.montantTotal - (rapport.avanceFrais ? (rapport.avanceFrais.montant - rapport.avanceFrais.montantRegularise) : 0),
    );

    await this.prisma.ndfRemboursement.upsert({
      where: { ndfRapportFraisId: id },
      create: {
        tenantId,
        ndfRapportFraisId: id,
        modeRemboursement: 'VIREMENT_SEPARE',
        montant: montantNetRembourser,
        statut: 'A_PAYER',
      },
      update: {
        montant: montantNetRembourser,
      },
    });

    return this.getRapportById(tenantId, id);
  }

  /**
   * Rejeter un rapport de frais avec motif
   */
  async rejeterRapport(
    tenantId: string,
    id: string,
    valideurId: string,
    dto: RejeterRapportDto,
  ) {
    const rapport = await this.getRapportById(tenantId, id);

    await this.prisma.ndfEtapeValidation.updateMany({
      where: { ndfRapportFraisId: id, statut: 'EN_ATTENTE' },
      data: {
        statut: 'REJETEE',
        dateDecision: new Date(),
        commentaire: dto.motifRejet,
      },
    });

    await this.prisma.ndfRapportFrais.update({
      where: { id },
      data: { statut: 'REJETE' },
    });

    await this.prisma.ndfHistoriqueStatut.create({
      data: {
        ndfRapportFraisId: id,
        ancienStatut: rapport.statut,
        nouveauStatut: 'REJETE',
        utilisateurId: valideurId,
        commentaire: `Rejeté : ${dto.motifRejet}`,
      },
    });

    return this.getRapportById(tenantId, id);
  }
}
