import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetNoteHonorairesDto,
  CreateCabinetTempsPasseDto,
  UpdateCabinetNoteHonorairesDto,
  UpdateCabinetTempsPasseDto,
} from '../dto/honoraires.dto';
import { TenantType } from '@prisma/client';

@Injectable()
export class HonorairesService {
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

  // TEMPS PASSÉ
  async listTempsPasses(
    cabinetTenantId: string,
    filters?: {
      collaborateurId?: string;
      mandatId?: string;
      missionId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetTempsPasse.findMany({
      where: {
        mission: {
          mandat: {
            cabinetEntiteId: entite.id,
            ...(filters?.mandatId && { id: filters.mandatId }),
          },
          ...(filters?.missionId && { id: filters.missionId }),
        },
        ...(filters?.collaborateurId && {
          collaborateurId: filters.collaborateurId,
        }),
        ...(filters?.startDate &&
          filters?.endDate && {
            datePrestation: {
              gte: new Date(filters.startDate),
              lte: new Date(filters.endDate),
            },
          }),
        isDeleted: false,
      },
      include: {
        collaborateur: {
          select: { id: true, nomPrenoms: true, email: true, role: true },
        },
        mission: {
          select: {
            id: true,
            libelle: true,
            mandat: {
              select: {
                id: true,
                typeMandat: true,
                clientTenantId: true,
              },
            },
          },
        },
      },
      orderBy: { datePrestation: 'desc' },
    });
  }

  async createTempsPasse(
    cabinetTenantId: string,
    userId: string | null,
    dto: CreateCabinetTempsPasseDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

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
        throw new BadRequestException('Aucun collaborateur trouvé pour enregistrer le temps.');
      }
    }

    const mission = await this.prisma.cabinetMission.findFirst({
      where: { id: dto.cabinetMissionId, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!mission) {
      throw new NotFoundException('Mission introuvable.');
    }

    return this.prisma.cabinetTempsPasse.create({
      data: {
        collaborateurId: collaborateur.id,
        cabinetMissionId: dto.cabinetMissionId,
        datePrestation: new Date(dto.datePrestation),
        dureeHeures: dto.dureeHeures,
        description: dto.description,
        facturable: dto.facturable ?? true,
      },
      include: {
        collaborateur: true,
        mission: true,
      },
    });
  }

  async updateTempsPasse(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetTempsPasseDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const temps = await this.prisma.cabinetTempsPasse.findFirst({
      where: { id, mission: { mandat: { cabinetEntiteId: entite.id } } },
    });
    if (!temps || temps.isDeleted) {
      throw new NotFoundException('Relevé de temps introuvable.');
    }

    return this.prisma.cabinetTempsPasse.update({
      where: { id },
      data: {
        ...(dto.datePrestation && {
          datePrestation: new Date(dto.datePrestation),
        }),
        ...(dto.dureeHeures !== undefined && { dureeHeures: dto.dureeHeures }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.facturable !== undefined && { facturable: dto.facturable }),
      },
      include: { collaborateur: true },
    });
  }

  async deleteTempsPasse(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const temps = await this.prisma.cabinetTempsPasse.findFirst({
      where: { id, mission: { mandat: { cabinetEntiteId: entite.id } } },
    });
    if (!temps) {
      throw new NotFoundException('Relevé de temps introuvable.');
    }

    await this.prisma.cabinetTempsPasse.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { success: true, message: 'Relevé de temps supprimé.' };
  }

  // NOTES D'HONORAIRES
  async listNotesHonoraires(cabinetTenantId: string, mandatId?: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetNoteHonoraires.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(mandatId && { id: mandatId }),
        },
        isDeleted: false,
      },
      include: {
        lignes: { where: { isDeleted: false } },
        mandat: {
          select: {
            id: true,
            typeMandat: true,
            clientTenantId: true,
            collaborateurResponsable: {
              select: { id: true, nomPrenoms: true },
            },
          },
        },
      },
      orderBy: { dateEmission: 'desc' },
    });
  }

  async getNoteHonorairesById(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const note = await this.prisma.cabinetNoteHonoraires.findFirst({
      where: { id, mandat: { cabinetEntiteId: entite.id }, isDeleted: false },
      include: {
        lignes: { where: { isDeleted: false } },
        mandat: {
          include: {
            collaborateurResponsable: true,
            contactsClient: true,
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note d’honoraires introuvable.');
    }
    return note;
  }

  async createNoteHonoraires(
    cabinetTenantId: string,
    dto: CreateCabinetNoteHonorairesDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetNoteHonoraires.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        numero: dto.numero,
        dateEmission: new Date(dto.dateEmission),
        montantTotalHt: dto.montantTotalHt,
        montantTva: dto.montantTva || 0,
        montantTotalTtc: dto.montantTotalTtc,
        deviseCode: dto.deviseCode || 'XOF',
        statut: dto.statut,
        lignes: {
          create: dto.lignes.map((l) => ({
            libelle: l.libelle,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            montant: l.montant,
          })),
        },
      },
      include: { lignes: true, mandat: true },
    });
  }

  async updateNoteHonoraires(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetNoteHonorairesDto,
  ) {
    await this.getNoteHonorairesById(cabinetTenantId, id);

    return this.prisma.cabinetNoteHonoraires.update({
      where: { id },
      data: {
        ...(dto.statut && { statut: dto.statut }),
        ...(dto.dateEmission && { dateEmission: new Date(dto.dateEmission) }),
      },
      include: { lignes: true },
    });
  }
}
