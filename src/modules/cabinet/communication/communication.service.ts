import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetDemandePieceDto,
  CreateCabinetDocumentPartageDto,
  CreateCabinetMessageDto,
  UpdateCabinetDemandePieceDto,
} from '../dto/communication.dto';
import { CabinetAuteurMessage, CabinetDeposeParType, CabinetStatutDemandePiece, TenantType } from '@prisma/client';

@Injectable()
export class CommunicationService {
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

  // DEMANDES DE PIÈCES
  async listDemandesPiece(cabinetTenantId: string, mandatId?: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetDemandePiece.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(mandatId && { id: mandatId }),
        },
        isDeleted: false,
      },
      include: {
        mandat: {
          select: {
            id: true,
            typeMandat: true,
            clientTenantId: true,
          },
        },
        mission: {
          select: { id: true, libelle: true },
        },
      },
      orderBy: [{ statut: 'asc' }, { dateDemande: 'desc' }],
    });
  }

  async createDemandePiece(
    cabinetTenantId: string,
    dto: CreateCabinetDemandePieceDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetDemandePiece.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        cabinetMissionId: dto.cabinetMissionId,
        libelle: dto.libelle,
        dateLimiteReponse: dto.dateLimiteReponse
          ? new Date(dto.dateLimiteReponse)
          : null,
        statut: dto.statut,
      },
    });
  }

  async updateDemandePiece(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetDemandePieceDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const demande = await this.prisma.cabinetDemandePiece.findFirst({
      where: { id, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!demande || demande.isDeleted) {
      throw new NotFoundException('Demande de pièce introuvable.');
    }

    return this.prisma.cabinetDemandePiece.update({
      where: { id },
      data: {
        ...(dto.libelle && { libelle: dto.libelle }),
        ...(dto.dateLimiteReponse !== undefined && {
          dateLimiteReponse: dto.dateLimiteReponse
            ? new Date(dto.dateLimiteReponse)
            : null,
        }),
        ...(dto.statut && { statut: dto.statut }),
      },
    });
  }

  async relancerDemandePiece(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const demande = await this.prisma.cabinetDemandePiece.findFirst({
      where: { id, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!demande) {
      throw new NotFoundException('Demande de pièce introuvable.');
    }

    return this.prisma.cabinetDemandePiece.update({
      where: { id },
      data: { statut: CabinetStatutDemandePiece.RELANCEE },
    });
  }

  // MESSAGERIE PAR MANDAT
  async listMessagesByMandat(cabinetTenantId: string, mandatId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: mandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetMessage.findMany({
      where: { cabinetClientMandatId: mandatId, isDeleted: false },
      orderBy: { dateEnvoi: 'asc' },
    });
  }

  async sendMessage(
    cabinetTenantId: string,
    userId: string | null,
    dto: CreateCabinetMessageDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });

    return this.prisma.cabinetMessage.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        auteurType: dto.auteurType || CabinetAuteurMessage.COLLABORATEUR_CABINET,
        auteurId: collaborateur?.id || userId || cabinetTenantId,
        auteurNom: collaborateur?.nomPrenoms || 'Cabinet',
        contenu: dto.contenu,
      },
    });
  }

  // DOCUMENTS PARTAGÉS
  async listDocumentsPartages(cabinetTenantId: string, mandatId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: mandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetDocumentPartage.findMany({
      where: { cabinetClientMandatId: mandatId, isDeleted: false },
      orderBy: { dateDepot: 'desc' },
    });
  }

  async addDocumentPartage(
    cabinetTenantId: string,
    userId: string | null,
    dto: CreateCabinetDocumentPartageDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });

    return this.prisma.cabinetDocumentPartage.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        deposeParType: dto.deposeParType || CabinetDeposeParType.COLLABORATEUR_CABINET,
        deposeParNom: collaborateur?.nomPrenoms || 'Cabinet',
        fichierUrl: dto.fichierUrl,
        libelle: dto.libelle,
        tailleOctets: dto.tailleOctets,
      },
    });
  }
}
