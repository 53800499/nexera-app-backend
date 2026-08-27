import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCarteAffaireDto,
  CreerRemboursementDto,
  EnregistrerPaiementDto,
  ImportTransactionCarteDto,
  RapprocherTransactionDto,
} from '../dto/remboursements.dto';

@Injectable()
export class RemboursementsCartesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // REMBOURSEMENTS
  // ----------------------------------------------------

  async getRemboursements(tenantId: string, statut?: any) {
    const where: any = { tenantId, isDeleted: false };
    if (statut) where.statut = statut;

    return this.prisma.ndfRemboursement.findMany({
      where,
      include: {
        rapportFrais: {
          include: {
            employe: {
              select: {
                id: true,
                matricule: true,
                nom: true,
                prenoms: true,
                coordonneesBancaires: true,
              },
            },
          },
        },
        remboursementPaieTransmis: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async executerRemboursement(
    tenantId: string,
    id: string,
    dto: EnregistrerPaiementDto,
  ) {
    const remboursement = await this.prisma.ndfRemboursement.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: { rapportFrais: { include: { employe: true } } },
    });

    if (!remboursement) {
      throw new NotFoundException(`Remboursement #${id} introuvable`);
    }

    if (remboursement.statut === 'PAYE') {
      throw new BadRequestException('Ce remboursement est déjà payé');
    }

    // 1. Mettre à jour le remboursement
    const updated = await this.prisma.ndfRemboursement.update({
      where: { id },
      data: {
        statut: 'PAYE',
        dateRemboursement: new Date(dto.dateRemboursement),
        referenceBancaire: dto.referenceBancaire || null,
      },
    });

    // 2. Mettre à jour le statut du rapport de frais
    await this.prisma.ndfRapportFrais.update({
      where: { id: remboursement.ndfRapportFraisId },
      data: { statut: 'REMBOURSE' },
    });

    // 3. Parallélisme M3 : Générer l'écriture comptable de paiement (EF-024)
    const ecriturePaiement = await this.prisma.ndfEcritureComptable.create({
      data: {
        tenantId,
        ndfRapportFraisId: remboursement.ndfRapportFraisId,
        typeEcriture: 'REMBOURSEMENT',
        dateEcriture: new Date(dto.dateRemboursement),
        montantTotalDebit: remboursement.montant,
        montantTotalCredit: remboursement.montant,
        statut: 'GENEREE',
      },
    });

    // Débit 4211 (Solde compte tiers salarié)
    await this.prisma.ndfEcritureComptableLigne.create({
      data: {
        ndfEcritureComptableId: ecriturePaiement.id,
        compteSyscohada: '4211',
        libelle: `Règlement note de frais ${remboursement.rapportFrais.numeroRapport} - ${remboursement.rapportFrais.employe.nom}`,
        sens: 'DEBIT',
        montant: remboursement.montant,
      },
    });

    // Crédit 5211 (Trésorerie Banque)
    await this.prisma.ndfEcritureComptableLigne.create({
      data: {
        ndfEcritureComptableId: ecriturePaiement.id,
        compteSyscohada: '5211',
        libelle: `Virement bancaire ${dto.referenceBancaire || ''}`,
        sens: 'CREDIT',
        montant: remboursement.montant,
      },
    });

    return updated;
  }

  async basculerSurBulletinPaie(
    tenantId: string,
    id: string,
    periodePaieCible: string,
  ) {
    const remboursement = await this.prisma.ndfRemboursement.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!remboursement) {
      throw new NotFoundException(`Remboursement #${id} introuvable`);
    }

    // Mise à jour mode
    await this.prisma.ndfRemboursement.update({
      where: { id },
      data: { modeRemboursement: 'INTEGRE_BULLETIN_PAIE' },
    });

    // Transmission vers M4 (EF-028 & EF-029)
    return this.prisma.ndfRemboursementPaieTransmis.upsert({
      where: { ndfRemboursementId: id },
      create: {
        ndfRemboursementId: id,
        periodePaieCible,
        statut: 'DEMANDE',
      },
      update: {
        periodePaieCible,
        statut: 'DEMANDE',
      },
    });
  }

  // ----------------------------------------------------
  // CARTES AFFAIRES
  // ----------------------------------------------------

  async getCartesAffaires(tenantId: string) {
    return this.prisma.ndfCarteAffaire.findMany({
      where: { tenantId, isDeleted: false },
      include: {
        employe: {
          select: {
            id: true,
            matricule: true,
            nom: true,
            prenoms: true,
          },
        },
        transactions: {
          where: { isDeleted: false },
          orderBy: { dateTransaction: 'desc' },
        },
      },
    });
  }

  async createCarteAffaire(tenantId: string, dto: CreateCarteAffaireDto) {
    return this.prisma.ndfCarteAffaire.create({
      data: {
        tenantId,
        employeRefId: dto.employeRefId,
        numeroMasque: dto.numeroMasque,
        emetteur: dto.emetteur || null,
        plafondMensuel: dto.plafondMensuel || null,
        statut: 'ACTIVE',
      },
      include: { employe: true },
    });
  }

  async importerTransactionCarte(
    tenantId: string,
    dto: ImportTransactionCarteDto,
  ) {
    return this.prisma.ndfTransactionCarteAffaire.create({
      data: {
        tenantId,
        ndfCarteAffaireId: dto.ndfCarteAffaireId,
        dateTransaction: new Date(dto.dateTransaction),
        montant: dto.montant,
        deviseCode: dto.deviseCode || 'XOF',
        libelleCommercant: dto.libelleCommercant || null,
        statutRapprochement: 'NON_RAPPROCHEE',
      },
    });
  }

  async rapprocherTransaction(tenantId: string, dto: RapprocherTransactionDto) {
    const transaction = await this.prisma.ndfTransactionCarteAffaire.findFirst({
      where: { id: dto.ndfTransactionCarteAffaireId, tenantId, isDeleted: false },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${dto.ndfTransactionCarteAffaireId} introuvable`);
    }

    const depense = await this.prisma.ndfDepense.findFirst({
      where: { id: dto.ndfDepenseId, tenantId, isDeleted: false },
    });

    if (!depense) {
      throw new NotFoundException(`Dépense #${dto.ndfDepenseId} introuvable`);
    }

    // Créer le rapprochement
    const rapprochement = await this.prisma.ndfRapprochementCarte.create({
      data: {
        ndfTransactionCarteAffaireId: transaction.id,
        ndfDepenseId: depense.id,
        modeRapprochement: 'MANUEL',
        scoreCorrespondance: 100,
      },
    });

    // Mettre à jour le statut de la transaction
    await this.prisma.ndfTransactionCarteAffaire.update({
      where: { id: transaction.id },
      data: { statutRapprochement: 'RAPPROCHEE' },
    });

    return rapprochement;
  }
}
