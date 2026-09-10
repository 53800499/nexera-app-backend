import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetEcheanceDto,
  CreateCabinetMissionDto,
  CreateCabinetTacheDto,
  UpdateCabinetEcheanceDto,
  UpdateCabinetMissionDto,
  UpdateCabinetTacheDto,
} from '../dto/missions.dto';
import {
  CabinetStatutEcheance,
  CabinetStatutMission,
  TenantType,
} from '@prisma/client';

@Injectable()
export class MissionsService {
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

  // MISSIONS
  async listMissions(
    cabinetTenantId: string,
    filters?: {
      mandatId?: string;
      statut?: CabinetStatutMission;
      collaborateurId?: string;
    },
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    // Refresh automatic overdue status
    const mandats = await this.prisma.cabinetClientMandat.findMany({
      where: { cabinetEntiteId: entite.id, isDeleted: false },
      select: { id: true },
    });
    const mandatIds = mandats.map((m) => m.id);

    if (mandatIds.length > 0) {
      const now = new Date();
      await this.prisma.cabinetMission.updateMany({
        where: {
          cabinetClientMandatId: { in: mandatIds },
          dateEcheance: { lt: now },
          statut: {
            in: [
              CabinetStatutMission.PLANIFIEE,
              CabinetStatutMission.EN_COURS,
              CabinetStatutMission.EN_REVUE,
            ],
          },
          isDeleted: false,
        },
        data: {
          statut: CabinetStatutMission.EN_RETARD,
        },
      });
    }

    return this.prisma.cabinetMission.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(filters?.mandatId && { id: filters.mandatId }),
        },
        ...(filters?.statut && { statut: filters.statut }),
        ...(filters?.collaborateurId && {
          taches: {
            some: {
              collaborateurAssigneId: filters.collaborateurId,
              isDeleted: false,
            },
          },
        }),
        isDeleted: false,
      },
      include: {
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
        taches: {
          where: { isDeleted: false },
          include: {
            collaborateurAssigne: {
              select: { id: true, nomPrenoms: true, email: true },
            },
          },
        },
        _count: {
          select: {
            taches: true,
            checklistsResultats: true,
            tempsPasses: true,
          },
        },
      },
      orderBy: [{ dateEcheance: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getMissionById(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const mission = await this.prisma.cabinetMission.findFirst({
      where: {
        id,
        mandat: { cabinetEntiteId: entite.id },
        isDeleted: false,
      },
      include: {
        mandat: {
          include: {
            collaborateurResponsable: true,
            contactsClient: true,
          },
        },
        taches: {
          where: { isDeleted: false },
          include: {
            collaborateurAssigne: true,
          },
        },
        checklistsResultats: {
          where: { isDeleted: false },
          include: {
            checklistControle: true,
            controlePar: true,
          },
        },
        tempsPasses: {
          where: { isDeleted: false },
          include: { collaborateur: true },
          orderBy: { datePrestation: 'desc' },
        },
        demandesPiece: {
          where: { isDeleted: false },
        },
      },
    });

    if (!mission) {
      throw new NotFoundException('Mission introuvable.');
    }
    return mission;
  }

  async createMission(cabinetTenantId: string, dto: CreateCabinetMissionDto) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetMission.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        libelle: dto.libelle,
        typeMission: dto.typeMission,
        periodeReference: dto.periodeReference,
        dateEcheance: dto.dateEcheance ? new Date(dto.dateEcheance) : null,
        statut: dto.statut,
      },
      include: {
        mandat: true,
        taches: true,
      },
    });
  }

  async updateMission(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetMissionDto,
  ) {
    await this.getMissionById(cabinetTenantId, id);
    return this.prisma.cabinetMission.update({
      where: { id },
      data: {
        ...(dto.libelle && { libelle: dto.libelle }),
        ...(dto.typeMission && { typeMission: dto.typeMission }),
        ...(dto.periodeReference !== undefined && {
          periodeReference: dto.periodeReference,
        }),
        ...(dto.dateEcheance !== undefined && {
          dateEcheance: dto.dateEcheance ? new Date(dto.dateEcheance) : null,
        }),
        ...(dto.statut && { statut: dto.statut }),
      },
      include: { mandat: true, taches: true },
    });
  }

  async deleteMission(cabinetTenantId: string, id: string) {
    await this.getMissionById(cabinetTenantId, id);
    await this.prisma.cabinetMission.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { success: true, message: 'Mission supprimée.' };
  }

  // TACHES
  async createTache(cabinetTenantId: string, dto: CreateCabinetTacheDto) {
    await this.getMissionById(cabinetTenantId, dto.cabinetMissionId);

    return this.prisma.cabinetTache.create({
      data: {
        cabinetMissionId: dto.cabinetMissionId,
        libelle: dto.libelle,
        collaborateurAssigneId: dto.collaborateurAssigneId,
        dateEcheance: dto.dateEcheance ? new Date(dto.dateEcheance) : null,
        statut: dto.statut,
      },
      include: { collaborateurAssigne: true },
    });
  }

  async updateTache(
    cabinetTenantId: string,
    tacheId: string,
    dto: UpdateCabinetTacheDto,
  ) {
    const tache = await this.prisma.cabinetTache.findUnique({
      where: { id: tacheId },
      include: { mission: true },
    });
    if (!tache || tache.isDeleted) {
      throw new NotFoundException('Tâche introuvable.');
    }
    await this.getMissionById(cabinetTenantId, tache.cabinetMissionId);

    return this.prisma.cabinetTache.update({
      where: { id: tacheId },
      data: {
        ...(dto.libelle && { libelle: dto.libelle }),
        ...(dto.collaborateurAssigneId !== undefined && {
          collaborateurAssigneId: dto.collaborateurAssigneId,
        }),
        ...(dto.dateEcheance !== undefined && {
          dateEcheance: dto.dateEcheance ? new Date(dto.dateEcheance) : null,
        }),
        ...(dto.statut && { statut: dto.statut }),
      },
      include: { collaborateurAssigne: true },
    });
  }

  async deleteTache(cabinetTenantId: string, tacheId: string) {
    const tache = await this.prisma.cabinetTache.findUnique({
      where: { id: tacheId },
    });
    if (!tache) {
      throw new NotFoundException('Tâche introuvable.');
    }

    await this.prisma.cabinetTache.update({
      where: { id: tacheId },
      data: { isDeleted: true },
    });
    return { success: true, message: 'Tâche supprimée.' };
  }

  // CALENDRIER CONSOLIDÉ
  async listEcheancesConsolidees(
    cabinetTenantId: string,
    filters?: {
      mandatId?: string;
      statut?: CabinetStatutEcheance;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetEcheanceConsolidee.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(filters?.mandatId && { id: filters.mandatId }),
        },
        ...(filters?.statut && { statut: filters.statut }),
        ...(filters?.startDate &&
          filters?.endDate && {
            dateLimite: {
              gte: new Date(filters.startDate),
              lte: new Date(filters.endDate),
            },
          }),
        isDeleted: false,
      },
      include: {
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
        mission: {
          select: { id: true, libelle: true },
        },
      },
      orderBy: { dateLimite: 'asc' },
    });
  }

  async createEcheance(cabinetTenantId: string, dto: CreateCabinetEcheanceDto) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return this.prisma.cabinetEcheanceConsolidee.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        libelle: dto.libelle,
        dateLimite: new Date(dto.dateLimite),
        referenceEcheanceM7: dto.referenceEcheanceM7,
        cabinetMissionId: dto.cabinetMissionId,
        statut: dto.statut,
      },
    });
  }

  async updateEcheance(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetEcheanceDto,
  ) {
    const ech = await this.prisma.cabinetEcheanceConsolidee.findUnique({
      where: { id },
      include: { mandat: true },
    });
    if (!ech || ech.isDeleted) {
      throw new NotFoundException('Échéance introuvable.');
    }

    return this.prisma.cabinetEcheanceConsolidee.update({
      where: { id },
      data: {
        ...(dto.libelle && { libelle: dto.libelle }),
        ...(dto.dateLimite && { dateLimite: new Date(dto.dateLimite) }),
        ...(dto.statut && { statut: dto.statut }),
      },
    });
  }
}
