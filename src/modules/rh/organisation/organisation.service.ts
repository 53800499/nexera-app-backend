import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateDepartementDto,
  CreateEtablissementDto,
  CreatePosteDto,
  UpdateDepartementDto,
  UpdateEtablissementDto,
  UpdatePosteDto,
} from './dto/organisation.dto';

@Injectable()
export class OrganisationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- ÉTABLISSEMENTS ----------------
  async getEtablissements(tenantId: string) {
    const etablissements = await this.prisma.rhEtablissement.findMany({
      where: { tenantId },
      include: {
        pays: true,
        conventionCollective: true,
        _count: {
          select: {
            departements: true,
            contrats: { where: { statut: 'ACTIF' } },
            affectations: { where: { estActuelle: true } },
          },
        },
      },
      orderBy: { raisonSociale: 'asc' },
    });

    return etablissements.map((e) => ({
      ...e,
      ifu: e.identifiantFiscal,
      numeroCnss: e.numeroEmployeurSecuSociale,
    }));
  }

  async getEtablissementById(id: string, tenantId: string) {
    const etablissement = await this.prisma.rhEtablissement.findFirst({
      where: { id, tenantId },
      include: {
        pays: true,
        conventionCollective: true,
        departements: {
          include: {
            postes: true,
          },
        },
      },
    });

    if (!etablissement) {
      throw new NotFoundException(`Établissement ${id} introuvable`);
    }

    return {
      ...etablissement,
      ifu: etablissement.identifiantFiscal,
      numeroCnss: etablissement.numeroEmployeurSecuSociale,
    };
  }

  async createEtablissement(dto: CreateEtablissementDto, tenantId: string) {
    const existing = await this.prisma.rhEtablissement.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Un établissement avec le code ${dto.code} existe déjà.`);
    }

    return this.prisma.rhEtablissement.create({
      data: {
        tenantId,
        paysCode: dto.paysCode,
        code: dto.code,
        raisonSociale: dto.raisonSociale,
        identifiantFiscal: dto.identifiantFiscal || dto.ifu,
        numeroEmployeurSecuSociale: dto.numeroEmployeurSecuSociale || dto.numeroCnss,
        conventionCollectiveId: dto.conventionCollectiveId,
        adresse: dto.adresse,
        ville: dto.ville,
        telephone: dto.telephone,
        email: dto.email,
        estSiege: dto.estSiege ?? false,
      },
    });
  }

  async updateEtablissement(id: string, dto: UpdateEtablissementDto, tenantId: string) {
    await this.getEtablissementById(id, tenantId);
    return this.prisma.rhEtablissement.update({
      where: { id },
      data: {
        ...dto,
        identifiantFiscal: dto.identifiantFiscal || dto.ifu,
        numeroEmployeurSecuSociale: dto.numeroEmployeurSecuSociale || dto.numeroCnss,
      },
    });
  }

  // ---------------- DÉPARTEMENTS ----------------
  async getDepartements(tenantId: string, etablissementId?: string) {
    return this.prisma.rhDepartement.findMany({
      where: {
        tenantId,
        ...(etablissementId ? { etablissementId } : {}),
      },
      include: {
        etablissement: true,
        departementParent: true,
        sousDepartements: true,
        postes: true,
        _count: {
          select: {
            postes: true,
            affectations: { where: { estActuelle: true } },
          },
        },
      },
      orderBy: { libelle: 'asc' },
    });
  }

  async createDepartement(dto: CreateDepartementDto, tenantId: string) {
    const existing = await this.prisma.rhDepartement.findFirst({
      where: { tenantId, etablissementId: dto.etablissementId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Un département avec le code ${dto.code} existe déjà.`);
    }

    const parentId = dto.departementParentId || dto.parentDepartementId;
    return this.prisma.rhDepartement.create({
      data: {
        tenantId,
        etablissementId: dto.etablissementId,
        code: dto.code,
        libelle: dto.libelle,
        departementParentId: parentId && parentId.trim() !== "" ? parentId : null,
        responsableId: dto.responsableId && dto.responsableId.trim() !== "" ? dto.responsableId : null,
      },
    });
  }

  async updateDepartement(id: string, dto: UpdateDepartementDto, tenantId: string) {
    const dept = await this.prisma.rhDepartement.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Département introuvable');
    return this.prisma.rhDepartement.update({
      where: { id },
      data: dto,
    });
  }

  // ---------------- POSTES ----------------
  async getPostes(tenantId: string, departementId?: string) {
    const postes = await this.prisma.rhPoste.findMany({
      where: {
        tenantId,
        ...(departementId ? { departementId } : {}),
      },
      include: {
        departement: {
          include: { etablissement: true },
        },
        categorieProfessionnelle: {
          include: { grillesSalariales: true },
        },
        contrats: {
          where: { statut: 'ACTIF' },
          select: { salaireBaseMensuel: true },
        },
        _count: {
          select: {
            contrats: { where: { statut: 'ACTIF' } },
            affectations: { where: { estActuelle: true } },
          },
        },
      },
      orderBy: { intitule: 'asc' },
    });

    return postes.map((p) => {
      let minSalary: number | undefined;
      let maxSalary: number | undefined;

      if (p.description && p.description.includes('<!--salary:')) {
        try {
          const match = p.description.match(/<!--salary:(.*?)-->/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            if (typeof parsed.min === 'number' && parsed.min > 0) minSalary = parsed.min;
            if (typeof parsed.max === 'number' && parsed.max > 0) maxSalary = parsed.max;
          }
        } catch {}
      }

      if (!minSalary && !maxSalary) {
        const activeSalaries = p.contrats
          .map((c) => c.salaireBaseMensuel)
          .filter((s) => typeof s === 'number' && s > 0);
        if (activeSalaries.length > 0) {
          minSalary = Math.min(...activeSalaries);
          maxSalary = Math.max(...activeSalaries);
        } else {
          const grilleMin = p.categorieProfessionnelle?.grillesSalariales?.[0]?.salaireMinimumMensuel;
          if (typeof grilleMin === 'number' && grilleMin > 0) {
            minSalary = grilleMin;
            maxSalary = Math.round(grilleMin * 1.75);
          }
        }
      }

      const cleanDesc = p.description ? p.description.replace(/<!--salary:.*?-->/g, '').trim() : p.description;

      return {
        ...p,
        description: cleanDesc || undefined,
        salaireMinConseille: minSalary,
        salaireMaxConseille: maxSalary,
      };
    });
  }

  async createPoste(dto: CreatePosteDto, tenantId: string) {
    const existing = await this.prisma.rhPoste.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Un poste avec le code ${dto.code} existe déjà.`);
    }

    let desc = dto.description || '';
    if (dto.salaireMinConseille || dto.salaireMaxConseille) {
      const meta = JSON.stringify({ min: dto.salaireMinConseille, max: dto.salaireMaxConseille });
      desc = desc ? `${desc}\n<!--salary:${meta}-->` : `<!--salary:${meta}-->`;
    }

    const created = await this.prisma.rhPoste.create({
      data: {
        tenantId,
        departementId: dto.departementId,
        code: dto.code,
        intitule: dto.intitule,
        description: desc || null,
        categorieProfessionnelleId: dto.categorieProfessionnelleId,
        niveauCompetenceRequis: dto.niveauCompetenceRequis,
      },
      include: {
        departement: {
          include: { etablissement: true },
        },
        categorieProfessionnelle: true,
      },
    });

    return {
      ...created,
      salaireMinConseille: dto.salaireMinConseille,
      salaireMaxConseille: dto.salaireMaxConseille,
    };
  }

  async updatePoste(id: string, dto: UpdatePosteDto, tenantId: string) {
    const poste = await this.prisma.rhPoste.findFirst({ where: { id, tenantId } });
    if (!poste) throw new NotFoundException('Poste introuvable');

    let desc = dto.description !== undefined ? dto.description : poste.description || '';
    if (dto.salaireMinConseille !== undefined || dto.salaireMaxConseille !== undefined) {
      const existingDesc = (desc || '').replace(/<!--salary:.*?-->/g, '').trim();
      const meta = JSON.stringify({ min: dto.salaireMinConseille, max: dto.salaireMaxConseille });
      desc = existingDesc ? `${existingDesc}\n<!--salary:${meta}-->` : `<!--salary:${meta}-->`;
    }

    return this.prisma.rhPoste.update({
      where: { id },
      data: {
        intitule: dto.intitule,
        description: desc || null,
        categorieProfessionnelleId: dto.categorieProfessionnelleId,
        niveauCompetenceRequis: dto.niveauCompetenceRequis,
        actif: dto.actif,
      },
      include: {
        departement: {
          include: { etablissement: true },
        },
        categorieProfessionnelle: true,
      },
    });
  }

  async deleteEtablissement(id: string, tenantId: string) {
    await this.getEtablissementById(id, tenantId);
    const contractsCount = await this.prisma.rhContrat.count({ where: { etablissementId: id, statut: 'ACTIF' } });
    if (contractsCount > 0) {
      throw new ConflictException(`Impossible de supprimer l'établissement car ${contractsCount} contrat(s) y sont rattachés.`);
    }
    return this.prisma.rhEtablissement.delete({ where: { id } });
  }

  async deleteDepartement(id: string, tenantId: string) {
    const dept = await this.prisma.rhDepartement.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Département introuvable');
    const postesCount = await this.prisma.rhPoste.count({ where: { departementId: id } });
    if (postesCount > 0) {
      throw new ConflictException(`Impossible de supprimer le département car ${postesCount} poste(s) y sont rattachés.`);
    }
    return this.prisma.rhDepartement.delete({ where: { id } });
  }

  async deletePoste(id: string, tenantId: string) {
    const poste = await this.prisma.rhPoste.findFirst({ where: { id, tenantId } });
    if (!poste) throw new NotFoundException('Poste introuvable');
    const contractsCount = await this.prisma.rhContrat.count({ where: { posteId: id, statut: 'ACTIF' } });
    if (contractsCount > 0) {
      throw new ConflictException(`Impossible de supprimer le poste car ${contractsCount} contrat(s) y sont rattachés.`);
    }
    return this.prisma.rhPoste.delete({ where: { id } });
  }
}
