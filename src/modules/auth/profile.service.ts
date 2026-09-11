import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthMessages } from './constants/auth-messages';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly userInclude = {
    tenant: true,
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!user || !user.isActive) {
      throw new NotFoundException(AuthMessages.PROFILE_NOT_FOUND);
    }

    const [settings, cabinetEntite, cabinetCollaborateur] = await Promise.all([
      this.settingsService.getTenantSettings(user.tenantId),
      user.tenant.type === 'cabinet'
        ? this.prisma.cabinetEntite.findUnique({ where: { tenantId: user.tenantId } })
        : null,
      user.tenant.type === 'cabinet'
        ? this.prisma.cabinetCollaborateur.findFirst({
            where: {
              OR: [{ userId: user.id }, { email: user.email }],
              isDeleted: false,
            },
            include: { role: true },
          })
        : null,
    ]);

    return this.toProfileResponse(user, settings, cabinetEntite, cabinetCollaborateur);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException(AuthMessages.PROFILE_NOT_FOUND);
    }

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const existing = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing && existing.id !== userId) {
          throw new BadRequestException(AuthMessages.EMAIL_ALREADY_USED);
        }
      }
    }

    const data: {
      firstName?: string;
      lastName?: string;
      email?: string;
    } = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: this.userInclude,
    });

    const [settings, cabinetEntite, cabinetCollaborateur] = await Promise.all([
      this.settingsService.getTenantSettings(updated.tenantId),
      updated.tenant.type === 'cabinet'
        ? this.prisma.cabinetEntite.findUnique({ where: { tenantId: updated.tenantId } })
        : null,
      updated.tenant.type === 'cabinet'
        ? this.prisma.cabinetCollaborateur.findFirst({
            where: {
              OR: [{ userId: updated.id }, { email: updated.email }],
              isDeleted: false,
            },
            include: { role: true },
          })
        : null,
    ]);

    return this.toProfileResponse(updated, settings, cabinetEntite, cabinetCollaborateur);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException(AuthMessages.PROFILE_NOT_FOUND);
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException(AuthMessages.CURRENT_PASSWORD_INVALID);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });

    return { message: AuthMessages.PASSWORD_UPDATED };
  }

  private toProfileResponse(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantId: string;
      isActive: boolean;
      isSuperAdmin: boolean;
      createdAt: Date;
      updatedAt: Date;
      tenant: { id: string; name: string; type: string };
      roles: Array<{
        role: {
          code: string;
          permissions: Array<{ permission: { code: string } }>;
        };
      }>;
    },
    tenantSettings: {
      legalName: string | null;
      tradeName: string | null;
      primaryCurrency: string;
      companyEmail: string | null;
    },
    cabinetEntite?: {
      id: string;
      raisonSociale: string;
      numeroInscriptionOrdre: string | null;
      paysCode: string;
      adresse: string | null;
      telephone: string | null;
      emailContact: string | null;
    } | null,
    cabinetCollaborateur?: {
      id: string;
      nomPrenoms: string;
      statut: string;
      numeroOrdreProfessionnel: string | null;
      role?: { code: string; libelle: string } | null;
    } | null,
  ) {
    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    ].sort();

    const cabinet = cabinetEntite
      ? {
          id: cabinetEntite.id,
          raisonSociale: cabinetEntite.raisonSociale,
          numeroInscriptionOrdre: cabinetEntite.numeroInscriptionOrdre,
          paysCode: cabinetEntite.paysCode,
          adresse: cabinetEntite.adresse,
          telephone: cabinetEntite.telephone,
          emailContact: cabinetEntite.emailContact,
        }
      : null;

    const collaborateur = cabinetCollaborateur
      ? {
          id: cabinetCollaborateur.id,
          nomPrenoms: cabinetCollaborateur.nomPrenoms,
          statut: cabinetCollaborateur.statut,
          numeroOrdreProfessionnel: cabinetCollaborateur.numeroOrdreProfessionnel,
          role: cabinetCollaborateur.role
            ? {
                code: cabinetCollaborateur.role.code,
                libelle: cabinetCollaborateur.role.libelle,
              }
            : null,
        }
      : null;

    const tenant = {
      id: user.tenant.id,
      name: cabinetEntite?.raisonSociale || tenantSettings.legalName || user.tenant.name,
      type: user.tenant.type,
      legalName: cabinetEntite?.raisonSociale || tenantSettings.legalName,
      tradeName: tenantSettings.tradeName,
      primaryCurrency: tenantSettings.primaryCurrency,
      companyEmail: cabinetEntite?.emailContact || tenantSettings.companyEmail,
      cabinet,
    };

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenant,
      tenantId: user.tenantId,
      tenantName: tenant.name,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      permissions,
      cabinet,
      collaborateur,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
