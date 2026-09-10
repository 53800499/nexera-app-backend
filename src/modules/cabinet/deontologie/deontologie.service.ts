import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ArbitrerCabinetConflitInteretDto,
  CreateCabinetConflitInteretDto,
  LogCabinetAccesSecretProDto,
} from '../dto/deontologie.dto';
import { TenantType } from '@prisma/client';

@Injectable()
export class DeontologieService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCabinetEntite(cabinetTenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: cabinetTenantId },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant introuvable.');
    }
    if (tenant.type !== TenantType.cabinet) {
      await this.prisma.tenant.update({
        where: { id: cabinetTenantId },
        data: { type: TenantType.cabinet },
      });
    }

    let entite = await this.prisma.cabinetEntite.findUnique({
      where: { tenantId: cabinetTenantId },
    });

    if (!entite) {
      entite = await this.prisma.cabinetEntite.create({
        data: {
          tenantId: cabinetTenantId,
          raisonSociale: tenant.name || 'Cabinet d’Expertise Comptable',
        },
      });
    }

    return entite;
  }

  // DÉCLARATIONS DE CONFLIT D'INTÉRÊTS
  async listConflitsInteret(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetConflitInteretDeclaration.findMany({
      where: {
        mandat: { cabinetEntiteId: entite.id },
        isDeleted: false,
      },
      include: {
        collaborateur: {
          select: { id: true, nomPrenoms: true, email: true, role: true },
        },
        decideur: {
          select: { id: true, nomPrenoms: true },
        },
        mandat: {
          select: {
            id: true,
            typeMandat: true,
            clientTenantId: true,
          },
        },
      },
      orderBy: { dateDeclaration: 'desc' },
    });
  }

  async declareConflitInteret(
    cabinetTenantId: string,
    userId: string | null,
    dto: CreateCabinetConflitInteretDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    let collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });
    if (!collaborateur) {
      collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
        where: { cabinetEntiteId: entite.id },
      });
      if (!collaborateur) {
        throw new BadRequestException('Aucun collaborateur trouvé.');
      }
    }

    return this.prisma.cabinetConflitInteretDeclaration.create({
      data: {
        collaborateurId: collaborateur.id,
        cabinetClientMandatId: dto.cabinetClientMandatId,
        natureConflit: dto.natureConflit,
      },
      include: {
        collaborateur: true,
        mandat: true,
      },
    });
  }

  async arbitrerConflitInteret(
    cabinetTenantId: string,
    conflitId: string,
    userId: string | null,
    dto: ArbitrerCabinetConflitInteretDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const conflit = await this.prisma.cabinetConflitInteretDeclaration.findFirst({
      where: { id: conflitId, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!conflit || conflit.isDeleted) {
      throw new NotFoundException('Déclaration de conflit introuvable.');
    }

    const decideur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });

    return this.prisma.cabinetConflitInteretDeclaration.update({
      where: { id: conflitId },
      data: {
        decision: dto.decision,
        decideeParCollaborateurId: decideur?.id || null,
        commentaireDecision: dto.commentaireDecision,
      },
      include: {
        collaborateur: true,
        decideur: true,
      },
    });
  }

  // JOURNAL D'ACCÈS RENFORCÉ (SECRET PROFESSIONNEL)
  async listJournalAcces(cabinetTenantId: string, mandatId?: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetJournalAccesConfidentialite.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(mandatId && { id: mandatId }),
        },
        isDeleted: false,
      },
      include: {
        collaborateur: {
          select: { id: true, nomPrenoms: true, email: true, role: true },
        },
        mandat: {
          select: {
            id: true,
            typeMandat: true,
            clientTenantId: true,
          },
        },
        habilitation: true,
      },
      orderBy: { dateAcces: 'desc' },
      take: 100,
    });
  }

  async logAccesSecretPro(
    cabinetTenantId: string,
    userId: string | null,
    dto: LogCabinetAccesSecretProDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });

    if (!collaborateur) {
      return { success: false, message: 'Collaborateur non identifié.' };
    }

    // Verify habilitation
    const habilitation = await this.prisma.cabinetHabilitationClient.findFirst({
      where: {
        collaborateurId: collaborateur.id,
        cabinetClientMandatId: dto.cabinetClientMandatId,
        isDeleted: false,
      },
    });

    if (!habilitation) {
      throw new ForbiddenException(
        'Accès non tracé : aucune habilitation en vigueur pour ce collaborateur sur ce dossier.',
      );
    }

    const log = await this.prisma.cabinetJournalAccesConfidentialite.create({
      data: {
        collaborateurId: collaborateur.id,
        cabinetClientMandatId: dto.cabinetClientMandatId,
        habilitationUtiliseeId: habilitation.id,
        moduleConsulte: dto.moduleConsulte,
        actionRealisee: dto.actionRealisee,
      },
    });

    return { success: true, logId: log.id };
  }
}
