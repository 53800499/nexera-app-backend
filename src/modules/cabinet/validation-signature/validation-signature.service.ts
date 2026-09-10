import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCabinetCircuitValidationDto,
  CreateCabinetSignatureDto,
  SubmitCabinetValidationDto,
} from '../dto/validation-signature.dto';
import {
  CabinetDecisionValidation,
  TenantType,
} from '@prisma/client';

@Injectable()
export class ValidationSignatureService {
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

  // CIRCUITS DE VALIDATION
  async listCircuitsValidation(cabinetTenantId: string) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    let circuits = await this.prisma.cabinetCircuitValidation.findMany({
      where: { cabinetEntiteId: entite.id, isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });

    if (circuits.length === 0) {
      // Seed default validation workflows
      await this.prisma.cabinetCircuitValidation.createMany({
        data: [
          {
            cabinetEntiteId: entite.id,
            typeObjetCible: 'rh_cycle_paie',
            actif: true,
            etapes: [
              {
                etape: 1,
                roleCode: 'COLLABORATEUR_SENIOR',
                libelle: 'Visa technique et contrôle des cotisations sociales',
              },
              {
                etape: 2,
                roleCode: 'ASSOCIE',
                libelle: 'Approbation finale et autorisation d’émission des bulletins',
              },
            ],
          },
          {
            cabinetEntiteId: entite.id,
            typeObjetCible: 'ndf_rapport_frais',
            actif: true,
            etapes: [
              {
                etape: 1,
                roleCode: 'COLLABORATEUR_JUNIOR',
                libelle: 'Vérification des justificatifs et conformité fiscale',
              },
              {
                etape: 2,
                roleCode: 'COLLABORATEUR_SENIOR',
                libelle: 'Validation du bon à payer et comptabilisation',
              },
            ],
          },
          {
            cabinetEntiteId: entite.id,
            typeObjetCible: 'tax_liasse_fiscale',
            actif: true,
            etapes: [
              {
                etape: 1,
                roleCode: 'COLLABORATEUR_SENIOR',
                libelle: 'Cadrage des tableaux fiscaux et annexes SYSCOHADA',
              },
              {
                etape: 2,
                roleCode: 'ASSOCIE',
                libelle: 'Visa légal de l’Expert-Comptable et signature',
              },
            ],
          },
        ],
      });

      circuits = await this.prisma.cabinetCircuitValidation.findMany({
        where: { cabinetEntiteId: entite.id, isDeleted: false },
      });
    }

    return circuits;
  }

  async createCircuitValidation(
    cabinetTenantId: string,
    dto: CreateCabinetCircuitValidationDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    return this.prisma.cabinetCircuitValidation.create({
      data: {
        cabinetEntiteId: entite.id,
        typeObjetCible: dto.typeObjetCible,
        etapes: dto.etapes,
        actif: dto.actif ?? true,
      },
    });
  }

  // DÉCISIONS DE VALIDATION
  async listValidationsByObjet(objetType: string, objetId: string) {
    return this.prisma.cabinetValidation.findMany({
      where: { objetType, objetId, isDeleted: false },
      include: {
        collaborateur: {
          include: { role: true },
        },
        circuitValidation: true,
      },
      orderBy: { etapeOrdre: 'asc' },
    });
  }

  async submitValidation(
    cabinetTenantId: string,
    userId: string | null,
    dto: SubmitCabinetValidationDto,
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
        throw new BadRequestException('Aucun collaborateur trouvé pour apposer la validation.');
      }
    }

    const validation = await this.prisma.cabinetValidation.create({
      data: {
        cabinetCircuitValidationId: dto.cabinetCircuitValidationId,
        objetType: dto.objetType,
        objetId: dto.objetId,
        etapeOrdre: dto.etapeOrdre,
        collaborateurId: collaborateur.id,
        decision: dto.decision,
        commentaire: dto.commentaire,
      },
      include: {
        collaborateur: { include: { role: true } },
      },
    });

    return {
      message:
        dto.decision === CabinetDecisionValidation.APPROUVE
          ? 'Étape validée avec succès.'
          : 'Décision enregistrée.',
      validation,
    };
  }

  // SIGNATURE ÉLECTRONIQUE
  async listSignaturesByObjet(objetType: string, objetId: string) {
    return this.prisma.cabinetSignatureElectronique.findMany({
      where: { objetType, objetId, isDeleted: false },
      include: {
        signataireCollaborateur: { include: { role: true } },
        signataireClientContact: true,
      },
      orderBy: { dateSignature: 'desc' },
    });
  }

  async apposeSignature(
    cabinetTenantId: string,
    clientIp: string | null,
    dto: CreateCabinetSignatureDto,
  ) {
    const entite = await this.getOrCreateCabinetEntite(cabinetTenantId);

    let collaborateur: any = null;
    if (!dto.signataireClientContactId) {
      collaborateur = await this.prisma.cabinetCollaborateur.findFirst({
        where: { cabinetEntiteId: entite.id },
      });
    }

    const signature = await this.prisma.cabinetSignatureElectronique.create({
      data: {
        objetType: dto.objetType,
        objetId: dto.objetId,
        signataireCollaborateurId: collaborateur?.id || null,
        signataireClientContactId: dto.signataireClientContactId || null,
        methodeSignature: dto.methodeSignature,
        empreinteDocument: dto.empreinteDocument,
        adresseIpSignataire: clientIp || '127.0.0.1',
      },
      include: {
        signataireCollaborateur: true,
        signataireClientContact: true,
      },
    });

    return {
      message: 'Signature électronique apposée avec valeur probante.',
      signature,
    };
  }
}
