import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreerControleFiscalDto,
  EstimerPenaliteDto,
  IntroduireRecoursDto,
  NotifierRedressementDto,
} from '../dto/fiscalite.dto';

@Injectable()
export class ControlesContentieuxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcul exact des pénalités fiscales selon le CGI Bénin 2026
   */
  estimerPenalite(dto: EstimerPenaliteDto) {
    let taux = 0;
    let detailsCalcul = '';

    switch (dto.typePenalite) {
      case 'RETARD_DECLARATION':
        // Art. 485 CGI : 20 % des droits ; 40 % si non déposée 30 jours après mise en demeure
        taux = dto.apresMiseEnDemeure ? 40.0 : 20.0;
        detailsCalcul = `CGI 2026 Art. 485 : ${taux}% des droits simples dus (${dto.apresMiseEnDemeure ? 'Majoration après mise en demeure 30j' : 'Taux standard'}).`;
        break;

      case 'INSUFFISANCE_DECLARATION':
        // Art. 486 CGI : 20 % standard, 40 % mauvaise foi / bénéfice réel, 80 % fraude
        taux = dto.mauvaiseFoi ? 40.0 : 20.0;
        detailsCalcul = `CGI 2026 Art. 486 : ${taux}% des droits éludés (${dto.mauvaiseFoi ? 'Mauvaise foi / inexactitude résultat' : 'Omission simple'}).`;
        break;

      case 'RETARD_PAIEMENT':
        // Art. 487 CGI : 10 % sur la portion non soldée
        taux = 10.0;
        detailsCalcul = `CGI 2026 Art. 487 : 10% forfaitaire pour retard de paiement d’impôt ou d’acompte.`;
        break;

      case 'INTERET_RETARD':
        // Art. 488 CGI : 0,25 % par mois ou fraction de mois de retard
        const nbMois = dto.nbMoisRetard || 1;
        taux = Math.min(100.0, Math.round(nbMois * 0.25 * 100) / 100);
        detailsCalcul = `CGI 2026 Art. 488 : 0,25% par mois × ${nbMois} mois = ${taux}% (plafonné aux droits simples).`;
        break;
    }

    const montantPenalite = Math.round((dto.baseCalcul * (taux / 100)) * 100) / 100;
    const totalExigible = dto.baseCalcul + montantPenalite;

    return {
      typePenalite: dto.typePenalite,
      baseCalcul: dto.baseCalcul,
      tauxApplique: taux,
      montantPenalite,
      totalExigible,
      detailsCalcul,
    };
  }

  // ----------------------------------------------------
  // PROCÉDURES DE CONTRÔLE FISCAL
  // ----------------------------------------------------

  async getControles(taxContribuableId: string) {
    return (this.prisma as any).taxControleFiscal.findMany({
      where: { taxContribuableId },
      include: {
        redressements: {
          include: {
            taxType: true,
            reclamations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async creerControle(dto: CreerControleFiscalDto) {
    return (this.prisma as any).taxControleFiscal.create({
      data: {
        taxContribuableId: dto.taxContribuableId,
        typeControle: dto.typeControle,
        dateAvisVerification: dto.dateAvisVerification ? new Date(dto.dateAvisVerification) : null,
        periodeControleeDebut: dto.periodeControleeDebut ? new Date(dto.periodeControleeDebut) : null,
        periodeControleeFin: dto.periodeControleeFin ? new Date(dto.periodeControleeFin) : null,
        serviceEnCharge: dto.serviceEnCharge,
        statut: 'EN_COURS',
      },
    });
  }

  async notifierRedressement(controleId: string, dto: NotifierRedressementDto) {
    const controle = await (this.prisma as any).taxControleFiscal.findUnique({
      where: { id: controleId },
    });
    if (!controle) {
      throw new NotFoundException('Contrôle fiscal introuvable.');
    }

    const redressement = await (this.prisma as any).taxRedressement.create({
      data: {
        taxControleFiscalId: controleId,
        taxTypeId: dto.taxTypeId,
        exerciceOuPeriodeConcerne: dto.exerciceOuPeriodeConcerne,
        motif: dto.motif,
        montantDroitsReclames: dto.montantDroitsReclames,
        montantPenalitesReclamees: dto.montantPenalitesReclamees || 0,
        statut: 'NOTIFIE',
      },
      include: { taxType: true },
    });

    // Mettre à jour le statut du contrôle
    await (this.prisma as any).taxControleFiscal.update({
      where: { id: controleId },
      data: { statut: 'CLOTURE_AVEC_REDRESSEMENT' },
    });

    return redressement;
  }

  // ----------------------------------------------------
  // VOIES DE RECOURS ET CONTENTIEUX
  // ----------------------------------------------------

  async getReclamations(taxContribuableId: string) {
    return (this.prisma as any).taxReclamationContentieuse.findMany({
      where: { taxContribuableId },
      include: { redressement: { include: { taxType: true } } },
      orderBy: { dateDepot: 'desc' },
    });
  }

  async introduireRecours(dto: IntroduireRecoursDto) {
    return (this.prisma as any).taxReclamationContentieuse.create({
      data: {
        taxContribuableId: dto.taxContribuableId,
        redressementId: dto.redressementId,
        typeRecours: dto.typeRecours,
        dateDepot: new Date(dto.dateDepot),
        objet: dto.objet,
        statut: 'EN_COURS',
      },
    });
  }

  async cloreRecours(id: string, statut: 'ACCEPTEE' | 'REJETEE' | 'PARTIELLEMENT_ACCEPTEE', decisionUrl?: string) {
    return (this.prisma as any).taxReclamationContentieuse.update({
      where: { id },
      data: {
        statut,
        decisionDocumentUrl: decisionUrl,
      },
    });
  }
}
