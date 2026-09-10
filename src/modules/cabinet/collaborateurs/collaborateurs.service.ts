import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetCollaborateurDto,
  CreateCabinetHabilitationDto,
  CreateCabinetRoleDto,
  UpdateCabinetCollaborateurDto,
  UpdateCabinetHabilitationDto,
} from '../dto/collaborateurs.dto';
import { CabinetNiveauHabilitation, TenantType } from '@prisma/client';

@Injectable()
export class CollaborateursService {
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

  // ROLES
  async listRoles() {
    let roles = await this.prisma.cabinetRole.findMany({
      where: { isDeleted: false },
      orderBy: { code: 'asc' },
    });

    if (roles.length === 0) {
      // Seed default cabinet roles
      await this.prisma.cabinetRole.createMany({
        data: [
          {
            code: 'ASSOCIE',
            libelle: 'Associé / Expert-comptable signataire',
            niveauHabilitationDefaut: CabinetNiveauHabilitation.SIGNATURE,
          },
          {
            code: 'COLLABORATEUR_SENIOR',
            libelle: 'Collaborateur Senior / Chef de mission',
            niveauHabilitationDefaut: CabinetNiveauHabilitation.VALIDATION,
          },
          {
            code: 'COLLABORATEUR_JUNIOR',
            libelle: 'Collaborateur Junior / Auditeur',
            niveauHabilitationDefaut: CabinetNiveauHabilitation.ANNOTATION,
          },
          {
            code: 'ASSISTANT',
            libelle: 'Assistant administratif / Suivi pièces',
            niveauHabilitationDefaut: CabinetNiveauHabilitation.CONSULTATION,
          },
        ],
        skipDuplicates: true,
      });

      roles = await this.prisma.cabinetRole.findMany({
        where: { isDeleted: false },
        orderBy: { code: 'asc' },
      });
    }

    return roles;
  }

  async createRole(dto: CreateCabinetRoleDto) {
    return this.prisma.cabinetRole.create({
      data: {
        code: dto.code.toUpperCase(),
        libelle: dto.libelle,
        niveauHabilitationDefaut: dto.niveauHabilitationDefaut,
      },
    });
  }

  // COLLABORATEURS
  async listCollaborateurs(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    return this.prisma.cabinetCollaborateur.findMany({
      where: { cabinetEntiteId: entite.id, isDeleted: false },
      include: {
        role: true,
        habilitations: {
          where: { isDeleted: false },
          include: { mandat: true },
        },
        _count: {
          select: {
            mandatsResponsable: true,
            taches: true,
            pointsRevue: true,
            validations: true,
          },
        },
      },
      orderBy: { nomPrenoms: 'asc' },
    });
  }

  async getCollaborateurById(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: { id, cabinetEntiteId: entite.id, isDeleted: false },
      include: {
        role: true,
        habilitations: {
          where: { isDeleted: false },
          include: { mandat: true },
        },
        taches: { where: { isDeleted: false } },
        pointsRevue: { where: { isDeleted: false } },
        tempsPasses: { where: { isDeleted: false } },
      },
    });

    if (!collaborateur) {
      throw new NotFoundException('Collaborateur introuvable.');
    }
    return collaborateur;
  }

  async createCollaborateur(
    cabinetTenantId: string,
    dto: CreateCabinetCollaborateurDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetCollaborateur.create({
      data: {
        cabinetEntiteId: entite.id,
        nomPrenoms: dto.nomPrenoms,
        roleId: dto.roleId,
        email: dto.email,
        telephone: dto.telephone,
        numeroOrdreProfessionnel: dto.numeroOrdreProfessionnel,
        userId: dto.userId,
        statut: dto.statut,
      },
      include: { role: true },
    });
  }

  async updateCollaborateur(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetCollaborateurDto,
  ) {
    await this.getCollaborateurById(cabinetTenantId, id);
    return this.prisma.cabinetCollaborateur.update({
      where: { id },
      data: {
        ...(dto.nomPrenoms && { nomPrenoms: dto.nomPrenoms }),
        ...(dto.roleId && { roleId: dto.roleId }),
        ...(dto.email && { email: dto.email }),
        ...(dto.telephone !== undefined && { telephone: dto.telephone }),
        ...(dto.numeroOrdreProfessionnel !== undefined && {
          numeroOrdreProfessionnel: dto.numeroOrdreProfessionnel,
        }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.statut && { statut: dto.statut }),
      },
      include: { role: true },
    });
  }

  async deleteCollaborateur(cabinetTenantId: string, id: string) {
    await this.getCollaborateurById(cabinetTenantId, id);
    await this.prisma.cabinetCollaborateur.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { success: true, message: 'Collaborateur retiré.' };
  }

  // HABILITATIONS PAR DOSSIER
  async listHabilitationsByMandat(cabinetTenantId: string, mandatId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    return this.prisma.cabinetHabilitationClient.findMany({
      where: {
        cabinetClientMandatId: mandatId,
        mandat: { cabinetEntiteId: entite.id },
        isDeleted: false,
      },
      include: {
        collaborateur: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHabilitation(
    cabinetTenantId: string,
    dto: CreateCabinetHabilitationDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: { id: dto.collaborateurId, cabinetEntiteId: entite.id },
    });
    if (!collaborateur) {
      throw new NotFoundException('Collaborateur introuvable.');
    }

    return this.prisma.cabinetHabilitationClient.upsert({
      where: {
        collaborateurId_cabinetClientMandatId: {
          collaborateurId: dto.collaborateurId,
          cabinetClientMandatId: dto.cabinetClientMandatId,
        },
      },
      create: {
        collaborateurId: dto.collaborateurId,
        cabinetClientMandatId: dto.cabinetClientMandatId,
        niveauAcces: dto.niveauAcces,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : new Date(),
        dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
      },
      update: {
        niveauAcces: dto.niveauAcces,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin !== undefined ? (dto.dateFin ? new Date(dto.dateFin) : null) : undefined,
        isDeleted: false,
      },
      include: {
        collaborateur: { include: { role: true } },
      },
    });
  }

  async updateHabilitation(
    cabinetTenantId: string,
    habilitationId: string,
    dto: UpdateCabinetHabilitationDto,
  ) {
    const hab = await this.prisma.cabinetHabilitationClient.findUnique({
      where: { id: habilitationId },
      include: { mandat: true },
    });
    if (!hab || hab.isDeleted) {
      throw new NotFoundException('Habilitation introuvable.');
    }

    return this.prisma.cabinetHabilitationClient.update({
      where: { id: habilitationId },
      data: {
        ...(dto.niveauAcces && { niveauAcces: dto.niveauAcces }),
        ...(dto.dateDebut && { dateDebut: new Date(dto.dateDebut) }),
        ...(dto.dateFin !== undefined && {
          dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        }),
      },
    });
  }

  async deleteHabilitation(cabinetTenantId: string, habilitationId: string) {
    const hab = await this.prisma.cabinetHabilitationClient.findUnique({
      where: { id: habilitationId },
    });
    if (!hab) {
      throw new NotFoundException('Habilitation introuvable.');
    }

    await this.prisma.cabinetHabilitationClient.update({
      where: { id: habilitationId },
      data: { isDeleted: true },
    });

    return { success: true, message: 'Habilitation révoquée.' };
  }
}
