import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetClientContactDto,
  CreateCabinetEntiteDto,
  CreateCabinetLettreMissionDto,
  CreateCabinetMandatDto,
  UpdateCabinetClientContactDto,
  UpdateCabinetEntiteDto,
  UpdateCabinetLettreMissionDto,
  UpdateCabinetMandatDto,
} from '../dto/portefeuille.dto';
import { TenantType } from '@prisma/client';

@Injectable()
export class PortefeuilleService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCabinetEntite(cabinetTenantId: string) {
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

  async updateCabinetEntite(
    cabinetTenantId: string,
    dto: UpdateCabinetEntiteDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    return this.prisma.cabinetEntite.update({
      where: { id: entite.id },
      data: {
        ...(dto.raisonSociale && { raisonSociale: dto.raisonSociale }),
        ...(dto.numeroInscriptionOrdre !== undefined && {
          numeroInscriptionOrdre: dto.numeroInscriptionOrdre,
        }),
        ...(dto.paysCode && { paysCode: dto.paysCode }),
        ...(dto.adresse !== undefined && { adresse: dto.adresse }),
        ...(dto.telephone !== undefined && { telephone: dto.telephone }),
        ...(dto.emailContact !== undefined && { emailContact: dto.emailContact }),
      },
    });
  }

  async listMandats(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    return this.prisma.cabinetClientMandat.findMany({
      where: { cabinetEntiteId: entite.id, isDeleted: false },
      include: {
        collaborateurResponsable: {
          select: { id: true, nomPrenoms: true, email: true },
        },
        lettresMission: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        contactsClient: {
          where: { isDeleted: false },
        },
        habilitations: {
          where: { isDeleted: false },
          include: {
            collaborateur: {
              select: { id: true, nomPrenoms: true, email: true },
            },
          },
        },
        _count: {
          select: {
            missions: true,
            pointsRevue: true,
            demandesPiece: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMandatById(cabinetTenantId: string, mandatId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: mandatId, cabinetEntiteId: entite.id, isDeleted: false },
      include: {
        collaborateurResponsable: true,
        lettresMission: { where: { isDeleted: false } },
        contactsClient: { where: { isDeleted: false } },
        habilitations: {
          where: { isDeleted: false },
          include: { collaborateur: { include: { role: true } } },
        },
        missions: {
          where: { isDeleted: false },
          include: { taches: true },
        },
        pointsRevue: {
          where: { isDeleted: false },
          include: { auteur: true },
          orderBy: { dateCreation: 'desc' },
        },
        notesHonoraires: {
          where: { isDeleted: false },
          include: { lignes: true },
        },
        demandesPiece: { where: { isDeleted: false } },
        documentsPartages: { where: { isDeleted: false } },
      },
    });

    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    return mandat;
  }

  async createMandat(cabinetTenantId: string, dto: CreateCabinetMandatDto) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const clientTenant = await this.prisma.tenant.findUnique({
      where: { id: dto.clientTenantId },
    });
    if (!clientTenant) {
      throw new NotFoundException('Entreprise cliente introuvable.');
    }

    // Auto-create or ensure CabinetCompanyAccess link
    await this.prisma.cabinetCompanyAccess.upsert({
      where: {
        cabinetTenantId_companyTenantId: {
          cabinetTenantId,
          companyTenantId: dto.clientTenantId,
        },
      },
      create: {
        cabinetTenantId,
        companyTenantId: dto.clientTenantId,
        permissions: ['cabinet.scope.invoices.read'],
      },
      update: {},
    });

    return this.prisma.cabinetClientMandat.create({
      data: {
        cabinetEntiteId: entite.id,
        clientTenantId: dto.clientTenantId,
        typeMandat: dto.typeMandat,
        dateDebut: new Date(dto.dateDebut),
        dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        statut: dto.statut,
        collaborateurResponsableId: dto.collaborateurResponsableId,
      },
      include: {
        collaborateurResponsable: true,
      },
    });
  }

  async updateMandat(
    cabinetTenantId: string,
    mandatId: string,
    dto: UpdateCabinetMandatDto,
  ) {
    await this.getMandatById(cabinetTenantId, mandatId);
    return this.prisma.cabinetClientMandat.update({
      where: { id: mandatId },
      data: {
        ...(dto.typeMandat && { typeMandat: dto.typeMandat }),
        ...(dto.dateDebut && { dateDebut: new Date(dto.dateDebut) }),
        ...(dto.dateFin !== undefined && {
          dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        }),
        ...(dto.statut && { statut: dto.statut }),
        ...(dto.collaborateurResponsableId !== undefined && {
          collaborateurResponsableId: dto.collaborateurResponsableId,
        }),
      },
    });
  }

  async deleteMandat(cabinetTenantId: string, mandatId: string) {
    await this.getMandatById(cabinetTenantId, mandatId);
    await this.prisma.cabinetClientMandat.update({
      where: { id: mandatId },
      data: { isDeleted: true },
    });
    return { success: true, message: 'Mandat supprimé (soft delete).' };
  }

  // LETTRES DE MISSION
  async createLettreMission(
    cabinetTenantId: string,
    dto: CreateCabinetLettreMissionDto,
  ) {
    await this.getMandatById(cabinetTenantId, dto.cabinetClientMandatId);
    return this.prisma.cabinetLettreMission.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        perimetreTexte: dto.perimetreTexte,
        honorairesConvenus: dto.honorairesConvenus,
        deviseCode: dto.deviseCode || 'XOF',
        periodiciteFacturation: dto.periodiciteFacturation,
        dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : null,
        documentUrl: dto.documentUrl,
        statut: dto.statut,
      },
    });
  }

  async updateLettreMission(
    cabinetTenantId: string,
    lettreId: string,
    dto: UpdateCabinetLettreMissionDto,
  ) {
    const lettre = await this.prisma.cabinetLettreMission.findUnique({
      where: { id: lettreId },
      include: { mandat: true },
    });
    if (!lettre || lettre.isDeleted) {
      throw new NotFoundException('Lettre de mission introuvable.');
    }
    await this.getMandatById(cabinetTenantId, lettre.cabinetClientMandatId);

    return this.prisma.cabinetLettreMission.update({
      where: { id: lettreId },
      data: {
        ...(dto.perimetreTexte && { perimetreTexte: dto.perimetreTexte }),
        ...(dto.honorairesConvenus !== undefined && {
          honorairesConvenus: dto.honorairesConvenus,
        }),
        ...(dto.deviseCode && { deviseCode: dto.deviseCode }),
        ...(dto.periodiciteFacturation && {
          periodiciteFacturation: dto.periodiciteFacturation,
        }),
        ...(dto.dateSignature !== undefined && {
          dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : null,
        }),
        ...(dto.documentUrl !== undefined && { documentUrl: dto.documentUrl }),
        ...(dto.statut && { statut: dto.statut }),
      },
    });
  }

  // CONTACTS CLIENTS
  async addClientContact(
    cabinetTenantId: string,
    dto: CreateCabinetClientContactDto,
  ) {
    await this.getMandatById(cabinetTenantId, dto.cabinetClientMandatId);
    return this.prisma.cabinetClientContact.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        nomPrenoms: dto.nomPrenoms,
        fonction: dto.fonction,
        email: dto.email,
        telephone: dto.telephone,
        contactPrincipal: dto.contactPrincipal || false,
      },
    });
  }

  async updateClientContact(
    cabinetTenantId: string,
    contactId: string,
    dto: UpdateCabinetClientContactDto,
  ) {
    const contact = await this.prisma.cabinetClientContact.findUnique({
      where: { id: contactId },
      include: { mandat: true },
    });
    if (!contact || contact.isDeleted) {
      throw new NotFoundException('Contact client introuvable.');
    }
    await this.getMandatById(cabinetTenantId, contact.cabinetClientMandatId);

    return this.prisma.cabinetClientContact.update({
      where: { id: contactId },
      data: {
        ...(dto.nomPrenoms && { nomPrenoms: dto.nomPrenoms }),
        ...(dto.fonction !== undefined && { fonction: dto.fonction }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telephone !== undefined && { telephone: dto.telephone }),
        ...(dto.contactPrincipal !== undefined && {
          contactPrincipal: dto.contactPrincipal,
        }),
      },
    });
  }
}
