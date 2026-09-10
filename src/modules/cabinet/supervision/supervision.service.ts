import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetChecklistControleDto,
  CreateCabinetPointRevueDto,
  SubmitChecklistItemResultatDto,
  UpdateCabinetPointRevueDto,
} from '../dto/supervision.dto';
import {
  CabinetModuleSource,
  CabinetNiveauSeverite,
  CabinetStatutPointRevue,
  TenantType,
} from '@prisma/client';

@Injectable()
export class SupervisionService {
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

  // POINTS DE REVUE
  async listPointsRevue(
    cabinetTenantId: string,
    filters?: {
      mandatId?: string;
      moduleSource?: CabinetModuleSource;
      statut?: CabinetStatutPointRevue;
      niveau?: CabinetNiveauSeverite;
    },
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetPointRevue.findMany({
      where: {
        mandat: {
          cabinetEntiteId: entite.id,
          ...(filters?.mandatId && { id: filters.mandatId }),
        },
        ...(filters?.moduleSource && { moduleSource: filters.moduleSource }),
        ...(filters?.statut && { statut: filters.statut }),
        ...(filters?.niveau && { niveau: filters.niveau }),
        isDeleted: false,
      },
      include: {
        auteur: {
          select: { id: true, nomPrenoms: true, email: true, role: true },
        },
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
      orderBy: [{ niveau: 'desc' }, { dateCreation: 'desc' }],
    });
  }

  async getPointsRevueByObjet(
    cabinetTenantId: string,
    objetType: string,
    objetId: string,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetPointRevue.findMany({
      where: {
        mandat: { cabinetEntiteId: entite.id },
        objetType,
        objetId,
        isDeleted: false,
      },
      include: {
        auteur: {
          select: { id: true, nomPrenoms: true, role: true },
        },
      },
      orderBy: { dateCreation: 'desc' },
    });
  }

  async createPointRevue(
    cabinetTenantId: string,
    userId: string | null,
    dto: CreateCabinetPointRevueDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mandat = await this.prisma.cabinetClientMandat.findFirst({
      where: { id: dto.cabinetClientMandatId, cabinetEntiteId: entite.id },
    });
    if (!mandat) {
      throw new NotFoundException('Mandat introuvable.');
    }

    // Resolve author collaborateur
    let collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: {
        cabinetEntiteId: entite.id,
        ...(userId ? { userId } : {}),
      },
    });

    if (!collaborateur) {
      // Fallback: pick any active collaborateur or create temporary
      collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
        where: { cabinetEntiteId: entite.id },
      });

      if (!collaborateur) {
        let role = await this.prisma.cabinetRole.findFirst();
        if (!role) {
          role = await this.prisma.cabinetRole.create({
            data: {
              code: 'ASSOCIE',
              libelle: 'Associé Signataire',
            },
          });
        }
        collaborateur = await this.prisma.cabinetCollaborateur.create({
          data: {
            cabinetEntiteId: entite.id,
            nomPrenoms: 'Expert-Comptable',
            email: 'expert@cabinet.com',
            roleId: role.id,
          },
        });
      }
    }

    return this.prisma.cabinetPointRevue.create({
      data: {
        cabinetClientMandatId: dto.cabinetClientMandatId,
        moduleSource: dto.moduleSource,
        objetType: dto.objetType,
        objetId: dto.objetId,
        auteurCollaborateurId: collaborateur.id,
        texte: dto.texte,
        niveau: dto.niveau,
        statut: dto.statut,
      },
      include: {
        auteur: true,
        mandat: true,
      },
    });
  }

  async updatePointRevue(
    cabinetTenantId: string,
    id: string,
    dto: UpdateCabinetPointRevueDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const point = await this.prisma.cabinetPointRevue.findFirst({
      where: { id, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!point || point.isDeleted) {
      throw new NotFoundException('Point de revue introuvable.');
    }

    return this.prisma.cabinetPointRevue.update({
      where: { id },
      data: {
        ...(dto.texte && { texte: dto.texte }),
        ...(dto.niveau && { niveau: dto.niveau }),
        ...(dto.statut && { statut: dto.statut }),
      },
      include: { auteur: true },
    });
  }

  async deletePointRevue(cabinetTenantId: string, id: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);
    const point = await this.prisma.cabinetPointRevue.findFirst({
      where: { id, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!point) {
      throw new NotFoundException('Point de revue introuvable.');
    }

    await this.prisma.cabinetPointRevue.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { success: true, message: 'Point de revue supprimé.' };
  }

  // CHECKLISTS QUALITÉ
  async listChecklistsControle(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    let checklists = await this.prisma.cabinetChecklistControle.findMany({
      where: { cabinetEntiteId: entite.id, isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });

    if (checklists.length === 0) {
      // Seed default checklists
      await this.prisma.cabinetChecklistControle.createMany({
        data: [
          {
            cabinetEntiteId: entite.id,
            typeMissionCible: 'TENUE_COMPTABLE',
            libelle: 'Checklist Clôture Mensuelle SYSCOHADA',
            version: '1.0',
            actif: true,
            items: [
              { id: '1', libelle: 'Cadrage des soldes de trésorerie et rapprochements bancaires', obligatoire: true },
              { id: '2', libelle: 'Contrôle des écritures de cut-off (achats et ventes)', obligatoire: true },
              { id: '3', libelle: 'Vérification de la balance auxiliaire clients et fournisseurs', obligatoire: true },
              { id: '4', libelle: 'Contrôle de la déclaration de TVA et cohérence CA3/G/L', obligatoire: true },
            ],
          },
          {
            cabinetEntiteId: entite.id,
            typeMissionCible: 'EXPERTISE_PAIE',
            libelle: 'Checklist Revue Cycle de Paie et Déclarations Sociales',
            version: '1.0',
            actif: true,
            items: [
              { id: '1', libelle: 'Vérification des taux de cotisations CNSS / IPRES / CNAM', obligatoire: true },
              { id: '2', libelle: 'Contrôle des heures supplémentaires et primes exonérées', obligatoire: true },
              { id: '3', libelle: 'Cadrage de la masse salariale brute avec le livre de paie', obligatoire: true },
              { id: '4', libelle: 'Vérification des soldes de tout compte et indemnités de départ', obligatoire: true },
            ],
          },
        ],
      });

      checklists = await this.prisma.cabinetChecklistControle.findMany({
        where: { cabinetEntiteId: entite.id, isDeleted: false },
      });
    }

    return checklists;
  }

  async createChecklistControle(
    cabinetTenantId: string,
    dto: CreateCabinetChecklistControleDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetChecklistControle.create({
      data: {
        cabinetEntiteId: entite.id,
        typeMissionCible: dto.typeMissionCible,
        libelle: dto.libelle,
        items: dto.items,
        version: dto.version || '1.0',
        actif: dto.actif ?? true,
      },
    });
  }

  async submitChecklistItemResultat(
    cabinetTenantId: string,
    dto: SubmitChecklistItemResultatDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const mission = await this.prisma.cabinetMission.findFirst({
      where: { id: dto.cabinetMissionId, mandat: { cabinetEntiteId: entite.id } },
    });
    if (!mission) {
      throw new NotFoundException('Mission introuvable.');
    }

    const collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
      where: { cabinetEntiteId: entite.id },
    });

    return this.prisma.cabinetChecklistItemResultat.create({
      data: {
        cabinetMissionId: dto.cabinetMissionId,
        cabinetChecklistControleId: dto.cabinetChecklistControleId,
        itemLibelle: dto.itemLibelle,
        statut: dto.statut,
        controleParCollaborateurId: collaborateur?.id,
        commentaire: dto.commentaire,
      },
      include: {
        controlePar: true,
        checklistControle: true,
      },
    });
  }
}
