import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateAvanceFraisDto,
  CreateMissionDto,
  RegulariserAvanceDto,
  UpdateMissionDto,
} from '../dto/missions.dto';

@Injectable()
export class MissionsAvancesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // ORDRES DE MISSION
  // ----------------------------------------------------

  async getMissions(
    tenantId: string,
    params?: { employeRefId?: string; statut?: any },
  ) {
    const where: any = { tenantId, isDeleted: false };
    if (params?.employeRefId) where.employeRefId = params.employeRefId;
    if (params?.statut) where.statut = params.statut;

    return this.prisma.ndfMission.findMany({
      where,
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
        avances: { where: { isDeleted: false } },
        rapportsFrais: { where: { isDeleted: false } },
      },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async getMissionById(tenantId: string, id: string) {
    const mission = await this.prisma.ndfMission.findFirst({
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
        avances: { where: { isDeleted: false } },
        rapportsFrais: {
          where: { isDeleted: false },
          include: { depenses: { where: { isDeleted: false } } },
        },
      },
    });

    if (!mission) {
      throw new NotFoundException(`Mission #${id} introuvable`);
    }

    return mission;
  }

  async createMission(tenantId: string, dto: CreateMissionDto) {
    // Vérifier l'existence de l'employé
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: dto.employeRefId, tenantId, isDeleted: false },
    });

    if (!employe) {
      throw new NotFoundException(`Salarié #${dto.employeRefId} introuvable`);
    }

    return this.prisma.ndfMission.create({
      data: {
        tenantId,
        employeRefId: dto.employeRefId,
        objet: dto.objet,
        lieuDestination: dto.lieuDestination || null,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        statut: 'PLANIFIEE',
      },
      include: {
        employe: {
          select: {
            id: true,
            matricule: true,
            nom: true,
            prenoms: true,
          },
        },
      },
    });
  }

  async updateMission(tenantId: string, id: string, dto: UpdateMissionDto) {
    const mission = await this.getMissionById(tenantId, id);

    return this.prisma.ndfMission.update({
      where: { id: mission.id },
      data: {
        objet: dto.objet ?? mission.objet,
        lieuDestination: dto.lieuDestination ?? mission.lieuDestination,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : mission.dateDebut,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : mission.dateFin,
        statut: (dto.statut as any) ?? mission.statut,
      },
    });
  }

  // ----------------------------------------------------
  // AVANCES DE FRAIS
  // ----------------------------------------------------

  async getAvances(
    tenantId: string,
    params?: { employeRefId?: string; statut?: any },
  ) {
    const where: any = { tenantId, isDeleted: false };
    if (params?.employeRefId) where.employeRefId = params.employeRefId;
    if (params?.statut) where.statut = params.statut;

    return this.prisma.ndfAvanceFrais.findMany({
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
      },
      orderBy: { dateVersement: 'desc' },
    });
  }

  async createAvance(tenantId: string, dto: CreateAvanceFraisDto) {
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id: dto.employeRefId, tenantId, isDeleted: false },
    });

    if (!employe) {
      throw new NotFoundException(`Salarié #${dto.employeRefId} introuvable`);
    }

    if (dto.missionId) {
      const mission = await this.prisma.ndfMission.findFirst({
        where: { id: dto.missionId, tenantId, isDeleted: false },
      });
      if (!mission) {
        throw new NotFoundException(`Mission #${dto.missionId} introuvable`);
      }
    }

    return this.prisma.ndfAvanceFrais.create({
      data: {
        tenantId,
        employeRefId: dto.employeRefId,
        missionId: dto.missionId || null,
        montant: dto.montant,
        deviseCode: dto.deviseCode || 'XOF',
        dateVersement: new Date(dto.dateVersement),
        montantRegularise: 0,
        statut: 'VERSEE',
      },
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
      },
    });
  }

  async regulariserAvance(tenantId: string, id: string, dto: RegulariserAvanceDto) {
    const avance = await this.prisma.ndfAvanceFrais.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!avance) {
      throw new NotFoundException(`Avance #${id} introuvable`);
    }

    const nouveauMontantRegularise = avance.montantRegularise + dto.montant;
    if (nouveauMontantRegularise > avance.montant) {
      throw new BadRequestException(
        `Le montant régularisé (${nouveauMontantRegularise}) ne peut excéder le montant de l'avance (${avance.montant})`,
      );
    }

    const nouveauStatut =
      nouveauMontantRegularise >= avance.montant
        ? 'SOLDEE'
        : 'PARTIELLEMENT_REGULARISEE';

    return this.prisma.ndfAvanceFrais.update({
      where: { id: avance.id },
      data: {
        montantRegularise: nouveauMontantRegularise,
        statut: nouveauStatut,
      },
    });
  }
}
