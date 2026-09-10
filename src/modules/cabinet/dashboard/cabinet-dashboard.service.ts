import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CabinetNiveauSeverite,
  CabinetStatutDemandePiece,
  CabinetStatutMandat,
  CabinetStatutMission,
  CabinetStatutNoteHonoraires,
  CabinetStatutPointRevue,
  TenantType,
} from '@prisma/client';

@Injectable()
export class CabinetDashboardService {
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

  async getCockpitMetrics(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    const [
      totalMandatsActifs,
      totalCollaborateurs,
      missionsEnRetard,
      pointsRevueBloquants,
      demandesPieceEnAttente,
      notesHonoraires,
      missionsRecentes,
      pointsRevueRecents,
      mandatsRecents,
    ] = await Promise.all([
      this.prisma.cabinetClientMandat.count({
        where: {
          cabinetEntiteId: entite.id,
          statut: CabinetStatutMandat.ACTIF,
          isDeleted: false,
        },
      }),
      this.prisma.cabinetCollaborateur.count({
        where: { cabinetEntiteId: entite.id, isDeleted: false },
      }),
      this.prisma.cabinetMission.count({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          statut: CabinetStatutMission.EN_RETARD,
          isDeleted: false,
        },
      }),
      this.prisma.cabinetPointRevue.count({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          niveau: CabinetNiveauSeverite.BLOQUANT,
          statut: {
            in: [
              CabinetStatutPointRevue.OUVERT,
              CabinetStatutPointRevue.EN_TRAITEMENT,
            ],
          },
          isDeleted: false,
        },
      }),
      this.prisma.cabinetDemandePiece.count({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          statut: {
            in: [
              CabinetStatutDemandePiece.EN_ATTENTE,
              CabinetStatutDemandePiece.RELANCEE,
            ],
          },
          isDeleted: false,
        },
      }),
      this.prisma.cabinetNoteHonoraires.findMany({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          statut: {
            in: [
              CabinetStatutNoteHonoraires.EMISE,
              CabinetStatutNoteHonoraires.EN_RETARD,
            ],
          },
          isDeleted: false,
        },
        select: { montantTotalTtc: true },
      }),
      this.prisma.cabinetMission.findMany({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          isDeleted: false,
        },
        include: {
          mandat: {
            select: { id: true, clientTenantId: true, typeMandat: true },
          },
        },
        orderBy: [{ dateEcheance: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.cabinetPointRevue.findMany({
        where: {
          mandat: { cabinetEntiteId: entite.id },
          statut: {
            in: [
              CabinetStatutPointRevue.OUVERT,
              CabinetStatutPointRevue.EN_TRAITEMENT,
            ],
          },
          isDeleted: false,
        },
        include: {
          auteur: { select: { nomPrenoms: true } },
          mandat: { select: { clientTenantId: true } },
        },
        orderBy: [{ niveau: 'desc' }, { dateCreation: 'desc' }],
        take: 5,
      }),
      this.prisma.cabinetClientMandat.findMany({
        where: { cabinetEntiteId: entite.id, isDeleted: false },
        include: {
          collaborateurResponsable: { select: { nomPrenoms: true } },
          _count: { select: { missions: true, pointsRevue: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    const totalHonorairesEnAttente = notesHonoraires.reduce(
      (acc, curr) => acc + curr.montantTotalTtc,
      0,
    );

    return {
      kpis: {
        totalMandatsActifs,
        totalCollaborateurs,
        missionsEnRetard,
        pointsRevueBloquants,
        demandesPieceEnAttente,
        totalHonorairesEnAttente,
      },
      missionsRecentes,
      pointsRevueRecents,
      mandatsRecents,
    };
  }
}
