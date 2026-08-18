import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';
import {
  CreateAffectationDto,
  CreateCoordonneeBancaireDto,
  CreateEmployeDocumentDto,
  CreateEmployeDto,
  CreatePersonneAChargeDto,
  UpdateEmployeDto,
} from './dto/employe.dto';

@Injectable()
export class EmployesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: RhAuditService,
  ) {}

  // Générateur de matricule automatique EMP-000001
  private async generateMatricule(tenantId: string): Promise<string> {
    const count = await this.prisma.rhEmploye.count({
      where: { tenantId },
    });
    const nextNum = (count + 1).toString().padStart(6, '0');
    return `EMP-${nextNum}`;
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 50,
    q?: string,
    statut?: string,
    etablissementId?: string,
    departementId?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      tenantId,
      isDeleted: false,
    };

    if (statut) {
      where.statutEmploi = statut;
    }

    if (q && q.trim()) {
      const search = q.trim();
      where.OR = [
        { matricule: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        { prenoms: { contains: search, mode: 'insensitive' } },
        { emailProfessionnel: { contains: search, mode: 'insensitive' } },
        { telephone1: { contains: search, mode: 'insensitive' } },
        { numeroIfu: { contains: search, mode: 'insensitive' } },
        { numeroCnss: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (etablissementId || departementId) {
      where.affectations = {
        some: {
          estActuelle: true,
          ...(etablissementId ? { etablissementId } : {}),
          ...(departementId ? { departementId } : {}),
        },
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.rhEmploye.count({ where }),
      this.prisma.rhEmploye.findMany({
        where,
        include: {
          affectations: {
            where: { estActuelle: true },
            include: {
              etablissement: true,
              departement: true,
              poste: true,
            },
            take: 1,
          },
          contrats: {
            where: { statut: 'ACTIF' },
            include: { categorieProfessionnelle: true },
            take: 1,
          },
          coordonneesBancaires: {
            where: { estComptePrincipal: true, actif: true },
            take: 1,
          },
        },
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string, userId?: string) {
    const employe = await this.prisma.rhEmploye.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        personnesACharge: {
          orderBy: { dateNaissance: 'asc' },
        },
        affectations: {
          include: {
            etablissement: true,
            departement: true,
            poste: true,
          },
          orderBy: { dateDebut: 'desc' },
        },
        coordonneesBancaires: {
          where: { actif: true },
          orderBy: { estComptePrincipal: 'desc' },
        },
        contrats: {
          include: {
            etablissement: true,
            poste: true,
            categorieProfessionnelle: true,
            conventionCollective: true,
            periodeEssai: true,
            avenants: { orderBy: { dateEffet: 'desc' } },
            rupture: true,
          },
          orderBy: { dateDebut: 'desc' },
        },
        soldesConges: {
          orderBy: { anneeReference: 'desc' },
          take: 3,
        },
        bulletinsPaie: {
          include: { cyclePaie: true },
          orderBy: { dateDebutPeriode: 'desc' },
          take: 12,
        },
        historiquesSalaire: {
          orderBy: { dateEffet: 'desc' },
          take: 10,
        },
      },
    });

    if (!employe) {
      throw new NotFoundException(`Employé ${id} introuvable`);
    }

    // Journaliser consultation dossier personnel
    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_employe',
      entiteId: id,
      actionAudit: 'CONSULTATION',
    });

    return employe;
  }

  async create(dto: CreateEmployeDto, tenantId: string, userId?: string) {
    const matricule = dto.matricule?.trim() || (await this.generateMatricule(tenantId));

    const existing = await this.prisma.rhEmploye.findFirst({
      where: { tenantId, matricule },
    });
    if (existing) {
      throw new ConflictException(`Le matricule ${matricule} est déjà attribué.`);
    }

    const employe = await this.prisma.rhEmploye.create({
      data: {
        tenantId,
        matricule,
        civilite: dto.civilite,
        nom: dto.nom.toUpperCase(),
        prenoms: dto.prenoms,
        nomJeuneFille: dto.nomJeuneFille,
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
        lieuNaissance: dto.lieuNaissance,
        nationaliteIso2: dto.nationaliteIso2 ?? 'BJ',
        sexe: dto.sexe ?? 'M',
        situationFamiliale: dto.situationFamiliale ?? 'CELIBATAIRE',
        nombreEnfantsCharge: dto.nombreEnfantsCharge ?? 0,
        typePieceIdentite: dto.typePieceIdentite ?? 'CNI',
        numeroPieceIdentite: dto.numeroPieceIdentite,
        dateExpirationPiece: dto.dateExpirationPiece ? new Date(dto.dateExpirationPiece) : null,
        npi: dto.npi,
        numeroCnss: dto.numeroCnss,
        numeroIfu: dto.numeroIfu,
        emailProfessionnel: dto.emailProfessionnel,
        emailPersonnel: dto.emailPersonnel,
        telephone1: dto.telephone1,
        telephone2: dto.telephone2,
        adresseResidence: dto.adresseResidence,
        villeResidence: dto.villeResidence,
        statutEmploi: dto.statutEmploi ?? 'ACTIF',
        dateEntreeEntreprise: new Date(dto.dateEntreeEntreprise),
        dateAnciennete: dto.dateAnciennete ? new Date(dto.dateAnciennete) : new Date(dto.dateEntreeEntreprise),
        createdBy: userId,
      },
    });

    // Affectation initiale si fournie
    if (dto.etablissementId && dto.posteId) {
      const depId =
        dto.departementId ||
        (
          await this.prisma.rhPoste.findUnique({
            where: { id: dto.posteId },
          })
        )?.departementId;

      if (depId) {
        await this.prisma.rhEmployeAffectation.create({
          data: {
            tenantId,
            employeId: employe.id,
            etablissementId: dto.etablissementId,
            departementId: depId,
            posteId: dto.posteId,
            dateDebut: new Date(dto.dateEntreeEntreprise),
            estActuelle: true,
            motifAffectation: 'Embauche initiale',
          },
        });
      }
    }

    // Initialiser le compteur de congés pour l'année en cours
    const currentYear = new Date().getFullYear();
    await this.prisma.rhSoldeConge.create({
      data: {
        tenantId,
        employeId: employe.id,
        anneeReference: currentYear,
        soldeDebutAnnee: 0,
        droitsAcquis: 0,
        droitsSupplementairesAnciennete: 0,
        droitsSupplementairesEnfants: 0,
        joursConsommes: 0,
        joursRestants: 0,
        soldeReporte: 0,
      },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_employe',
      entiteId: employe.id,
      actionAudit: 'CREATION',
      champsModifiesJson: { matricule: employe.matricule, nom: employe.nom },
    });

    return employe;
  }

  async update(id: string, dto: UpdateEmployeDto, tenantId: string, userId?: string) {
    const existing = await this.prisma.rhEmploye.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      throw new NotFoundException(`Employé ${id} introuvable`);
    }

    const {
      etablissementId,
      departementId,
      posteId,
      dateEntreeEntreprise,
      dateAnciennete,
      ...directFields
    } = dto;

    const updated = await this.prisma.rhEmploye.update({
      where: { id },
      data: {
        ...directFields,
        nom: directFields.nom ? directFields.nom.toUpperCase() : undefined,
        dateNaissance: directFields.dateNaissance ? new Date(directFields.dateNaissance) : undefined,
        dateExpirationPiece: directFields.dateExpirationPiece ? new Date(directFields.dateExpirationPiece) : undefined,
        dateSortieDefinitive: directFields.dateSortieDefinitive ? new Date(directFields.dateSortieDefinitive) : undefined,
        dateEntreeEntreprise: dateEntreeEntreprise ? new Date(dateEntreeEntreprise) : undefined,
        dateAnciennete: dateAnciennete ? new Date(dateAnciennete) : undefined,
        updatedBy: userId,
      },
    });

    // Mettre à jour l'affectation actuelle si spécifiée
    if (etablissementId && posteId) {
      const depId =
        departementId ||
        (
          await this.prisma.rhPoste.findUnique({
            where: { id: posteId },
          })
        )?.departementId;

      if (depId) {
        const currentAff = await this.prisma.rhEmployeAffectation.findFirst({
          where: { employeId: id, tenantId, estActuelle: true },
        });

        const isSame =
          currentAff &&
          currentAff.etablissementId === etablissementId &&
          currentAff.posteId === posteId &&
          currentAff.departementId === depId;

        if (!isSame) {
          await this.prisma.rhEmployeAffectation.updateMany({
            where: { employeId: id, tenantId, estActuelle: true },
            data: { estActuelle: false, dateFin: new Date() },
          });

          await this.prisma.rhEmployeAffectation.create({
            data: {
              tenantId,
              employeId: id,
              etablissementId,
              departementId: depId,
              posteId,
              dateDebut: new Date(),
              estActuelle: true,
              motifAffectation: 'Mise à jour fiche collaborateur',
            },
          });
        }
      }
    }

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_employe',
      entiteId: id,
      actionAudit: 'MODIFICATION',
      champsModifiesJson: dto,
    });

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.rhEmploye.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      throw new NotFoundException(`Employé ${id} introuvable`);
    }

    await this.prisma.rhEmploye.update({
      where: { id },
      data: { isDeleted: true, updatedBy: userId },
    });

    await this.auditService.log({
      tenantId,
      utilisateurId: userId,
      entiteNom: 'rh_employe',
      entiteId: id,
      actionAudit: 'SUPPRESSION',
    });

    return { success: true, message: 'Employé supprimé avec succès (archivage logique).' };
  }

  // --- PERSONNES À CHARGE ---
  async addPersonneACharge(employeId: string, dto: CreatePersonneAChargeDto, tenantId: string) {
    const employe = await this.prisma.rhEmploye.findFirst({ where: { id: employeId, tenantId } });
    if (!employe) throw new NotFoundException('Employé introuvable');

    const pac = await this.prisma.rhEmployePersonneACharge.create({
      data: {
        tenantId,
        employeId,
        lienParente: dto.lienParente,
        nomPrenoms: dto.nomPrenoms,
        dateNaissance: new Date(dto.dateNaissance),
        estFiscalementACharge: dto.estFiscalementACharge ?? true,
      },
    });

    // Mettre à jour le nombre d'enfants si lien = ENFANT
    if (dto.lienParente === 'ENFANT') {
      await this.prisma.rhEmploye.update({
        where: { id: employeId },
        data: { nombreEnfantsCharge: { increment: 1 } },
      });
    }

    return pac;
  }

  async removePersonneACharge(id: string, tenantId: string) {
    const pac = await this.prisma.rhEmployePersonneACharge.findFirst({ where: { id, tenantId } });
    if (!pac) throw new NotFoundException('Personne à charge introuvable');

    await this.prisma.rhEmployePersonneACharge.delete({ where: { id } });

    if (pac.lienParente === 'ENFANT') {
      await this.prisma.rhEmploye.update({
        where: { id: pac.employeId },
        data: { nombreEnfantsCharge: { decrement: 1 } },
      });
    }

    return { success: true };
  }

  // --- COORDONNÉES BANCAIRES ---
  async addCoordonneeBancaire(employeId: string, dto: CreateCoordonneeBancaireDto, tenantId: string) {
    const employe = await this.prisma.rhEmploye.findFirst({ where: { id: employeId, tenantId } });
    if (!employe) throw new NotFoundException('Employé introuvable');

    if (dto.estComptePrincipal) {
      await this.prisma.rhEmployeCoordonneeBancaire.updateMany({
        where: { employeId, tenantId },
        data: { estComptePrincipal: false },
      });
    }

    return this.prisma.rhEmployeCoordonneeBancaire.create({
      data: {
        tenantId,
        employeId,
        modePaiement: dto.modePaiement,
        banqueNom: dto.banqueNom,
        codeBanque: dto.codeBanque,
        codeGuichet: dto.codeGuichet,
        numeroCompteIban: dto.numeroCompteIban,
        cleRib: dto.cleRib,
        operateurMobileMoney: dto.operateurMobileMoney,
        numeroMobileMoney: dto.numeroMobileMoney,
        estComptePrincipal: dto.estComptePrincipal ?? true,
      },
    });
  }

  // --- AFFECTATIONS DE POSTE ---
  async addAffectation(employeId: string, dto: CreateAffectationDto, tenantId: string) {
    const employe = await this.prisma.rhEmploye.findFirst({ where: { id: employeId, tenantId } });
    if (!employe) throw new NotFoundException('Employé introuvable');

    const depId =
      dto.departementId ||
      (
        await this.prisma.rhPoste.findUnique({
          where: { id: dto.posteId },
        })
      )?.departementId;

    if (!depId) {
      throw new NotFoundException('Département obligatoire ou non rattaché au poste sélectionné');
    }

    // Clôturer l'affectation actuelle précédente
    await this.prisma.rhEmployeAffectation.updateMany({
      where: { employeId, tenantId, estActuelle: true },
      data: { estActuelle: false, dateFin: new Date(dto.dateDebut) },
    });

    return this.prisma.rhEmployeAffectation.create({
      data: {
        tenantId,
        employeId,
        etablissementId: dto.etablissementId,
        departementId: depId,
        posteId: dto.posteId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        motifAffectation: dto.motifAffectation || dto.motif || 'Mutation / Affectation interne',
        estActuelle: true,
      },
    });
  }

  // --- DOCUMENTS ADMINISTRATIFS ---
  async addDocument(employeId: string, dto: CreateEmployeDocumentDto, tenantId: string) {
    const employe = await this.prisma.rhEmploye.findFirst({ where: { id: employeId, tenantId } });
    if (!employe) throw new NotFoundException('Employé introuvable');

    return this.prisma.rhEmployeDocument.create({
      data: {
        tenantId,
        employeId,
        typeDocument: dto.typeDocument,
        libelle: dto.libelle || dto.titre || 'Document administratif',
        fichierUrl: dto.fichierUrl,
        nomFichier: dto.nomFichier,
        dateEmission: dto.dateEmission ? new Date(dto.dateEmission) : null,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
        statutVerification: 'VERIFIE',
      },
    });
  }
}
