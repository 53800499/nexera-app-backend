import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateCompteAuxiliaireDto,
  CreateCompteDto,
  ImportPlanComptableDto,
  UpdateCompteDto,
} from '../dto/compta.dto';

@Injectable()
export class PlanComptableService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- RÉFÉRENTIEL MODÈLE SYSCOHADA ----------------

  async listModeles(paysCode = 'BJ', classe?: number, search?: string) {
    const pays = await (this.prisma as any).comptaPays.findUnique({
      where: { codeIso: paysCode },
    });
    if (!pays) return [];

    return (this.prisma as any).comptaPlanComptableModele.findMany({
      where: {
        paysId: pays.id,
        ...(classe ? { classe } : {}),
        ...(search
          ? {
              OR: [
                { numeroCompte: { contains: search, mode: 'insensitive' } },
                { libelle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { numeroCompte: 'asc' },
    });
  }

  // ---------------- PLAN COMPTABLE DU TENANT ----------------

  async listComptes(tenantId: string, classe?: number, statut?: string, search?: string) {
    const comptes = await (this.prisma as any).comptaCompte.findMany({
      where: {
        tenantId,
        ...(classe ? { classe } : {}),
        ...(statut ? { statut } : {}),
        ...(search
          ? {
              OR: [
                { numeroCompte: { contains: search, mode: 'insensitive' } },
                { libelle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        comptesAuxiliaires: {
          where: { statut: 'ACTIF' },
          orderBy: { numeroAuxiliaire: 'asc' },
        },
      },
      orderBy: { numeroCompte: 'asc' },
    });

    return comptes.map((c: any) => ({
      ...c,
      numero: c.numeroCompte,
      intitule: c.libelle,
      actif: c.statut === 'ACTIF',
      auxiliaires: (c.comptesAuxiliaires || []).map((a: any) => ({
        ...a,
        codeAuxiliaire: a.numeroAuxiliaire,
        intitule: a.libelle,
        actif: a.statut === 'ACTIF',
      })),
    }));
  }

  async getCompteById(tenantId: string, id: string) {
    if (!id || id === 'auxiliaires' || id === 'modeles' || id === 'comptes') {
      throw new NotFoundException('Compte comptable introuvable.');
    }
    const compte = await (this.prisma as any).comptaCompte.findFirst({
      where: {
        OR: [{ id }, { numeroCompte: id }],
        tenantId,
      },
      include: { comptesAuxiliaires: true },
    });
    if (!compte) {
      throw new NotFoundException('Compte comptable introuvable.');
    }
    return {
      ...compte,
      numero: compte.numeroCompte,
      intitule: compte.libelle,
      actif: compte.statut === 'ACTIF',
      auxiliaires: (compte.comptesAuxiliaires || []).map((a: any) => ({
        ...a,
        codeAuxiliaire: a.numeroAuxiliaire,
        intitule: a.libelle,
        actif: a.statut === 'ACTIF',
      })),
    };
  }

  async createCompte(tenantId: string, dto: CreateCompteDto, userId: string) {
    const rawNumero = (dto.numeroCompte || dto.numero || '').trim();
    // Normaliser en retirant les espaces et points séparateurs éventuels
    const numeroCompte = rawNumero.replace(/[\s.-]/g, '');
    const libelle = (dto.libelle || dto.intitule || '').trim();
    const premierCaractere = parseInt(numeroCompte.charAt(0), 10);
    const classe =
      dto.classe ||
      (!isNaN(premierCaractere) && premierCaractere >= 1 && premierCaractere <= 9
        ? premierCaractere
        : 1);

    if (!numeroCompte || !libelle) {
      throw new BadRequestException('Le numéro de compte et le libellé sont obligatoires.');
    }

    if (numeroCompte.length < 2) {
      throw new BadRequestException('Le numéro de compte doit comporter au moins 2 caractères.');
    }

    // EF-002: Seule la classe 4 peut avoir des caractères alphanumériques
    if (classe !== 4 && !/^\d+$/.test(numeroCompte)) {
      throw new BadRequestException(
        'Seuls les comptes de classe 4 peuvent comporter des lettres ou caractères alphanumériques (Règle EF-002 AUDCIF).',
      );
    }

    const existant = await (this.prisma as any).comptaCompte.findUnique({
      where: {
        tenantId_numeroCompte: {
          tenantId,
          numeroCompte,
        },
      },
    });

    if (existant) {
      // Si le compte existe déjà dans le plan mais était inactif, on le réactive
      if (existant.statut === 'DESACTIVE') {
        const reactivated = await (this.prisma as any).comptaCompte.update({
          where: { id: existant.id },
          data: {
            libelle,
            statut: 'ACTIF',
            modifiePar: userId,
          },
        });
        return {
          ...reactivated,
          numero: reactivated.numeroCompte,
          intitule: reactivated.libelle,
          actif: true,
        };
      }
      throw new ConflictException(
        `Le compte ${numeroCompte} (${existant.libelle}) existe déjà dans votre plan comptable.`,
      );
    }

    const created = await (this.prisma as any).comptaCompte.create({
      data: {
        tenantId,
        numeroCompte,
        libelle,
        classe,
        modeleId: dto.modeleId,
        statut: dto.actif === false ? 'DESACTIVE' : 'ACTIF',
        mouvemente: false,
        creePar: userId,
      },
    });

    return {
      ...created,
      numero: created.numeroCompte,
      intitule: created.libelle,
      actif: created.statut === 'ACTIF',
    };
  }

  async updateCompte(tenantId: string, id: string, dto: UpdateCompteDto, userId: string) {
    const compte = await this.getCompteById(tenantId, id);
    const libelle = dto.libelle || dto.intitule;

    // EF-004: Un compte mouvementé ne peut pas être désactivé, seulement archivé
    if (dto.statut === 'DESACTIVE' && compte.mouvemente) {
      throw new BadRequestException(
        'Règle EF-004 : Un compte déjà mouvementé ne peut pas être désactivé, il peut uniquement être archivé.',
      );
    }

    return (this.prisma as any).comptaCompte.update({
      where: { id },
      data: {
        ...(libelle ? { libelle } : {}),
        ...(dto.statut ? { statut: dto.statut } : {}),
        modifiePar: userId,
      },
    });
  }

  async toggleActif(tenantId: string, id: string, userId: string) {
    const compte = await this.getCompteById(tenantId, id);
    const nouveauStatut = compte.statut === 'ACTIF' ? 'DESACTIVE' : 'ACTIF';
    if (nouveauStatut === 'DESACTIVE' && compte.mouvemente) {
      throw new BadRequestException(
        'Règle EF-004 : Un compte déjà mouvementé ne peut pas être désactivé, il peut uniquement être archivé.',
      );
    }
    return (this.prisma as any).comptaCompte.update({
      where: { id },
      data: {
        statut: nouveauStatut,
        modifiePar: userId,
      },
    });
  }

  // ---------------- COMPTES AUXILIAIRES (TIERS) ----------------

  async listAuxiliaires(tenantId: string, compteCollectifId?: string, search?: string) {
    let collectifWhere: any = {};
    if (compteCollectifId) {
      collectifWhere = {
        OR: [
          { compteCollectifId: compteCollectifId },
          { compteCollectif: { numeroCompte: compteCollectifId } },
          { compteCollectif: { numeroCompte: { startsWith: compteCollectifId } } },
        ],
      };
    }

    const auxs = await (this.prisma as any).comptaCompteAuxiliaire.findMany({
      where: {
        tenantId,
        ...collectifWhere,
        ...(search
          ? {
              OR: [
                { numeroAuxiliaire: { contains: search, mode: 'insensitive' } },
                { libelle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { compteCollectif: true },
      orderBy: { numeroAuxiliaire: 'asc' },
    });

    return auxs.map((a: any) => ({
      ...a,
      codeAuxiliaire: a.numeroAuxiliaire,
      intitule: a.libelle,
      actif: a.statut === 'ACTIF',
      compteCollectifNumero: a.compteCollectif?.numeroCompte,
      compteCollectifIntitule: a.compteCollectif?.libelle,
    }));
  }

  async createAuxiliaire(tenantId: string, dto: CreateCompteAuxiliaireDto, userId: string) {
    const compteCollectif = await (this.prisma as any).comptaCompte.findFirst({
      where: {
        OR: [
          { id: dto.compteCollectifId },
          { numeroCompte: dto.compteCollectifId },
        ],
        tenantId,
      },
    });

    if (!compteCollectif) {
      throw new NotFoundException('Compte collectif de classe 4 introuvable.');
    }

    if (compteCollectif.classe !== 4) {
      throw new BadRequestException('Un compte auxiliaire ne peut être rattaché qu’à un compte de classe 4 (EF-002).');
    }

    const numeroAux = (dto.numeroAuxiliaire || dto.codeAuxiliaire || '').trim().toUpperCase();
    const libelle = (dto.libelle || dto.intitule || '').trim();
    const tiersType = (dto.tiersType || dto.typeTiers || 'CLIENT') as any;

    if (!numeroAux || !libelle) {
      throw new BadRequestException('Le code et l’intitulé du compte auxiliaire sont requis.');
    }

    const existant = await (this.prisma as any).comptaCompteAuxiliaire.findUnique({
      where: {
        tenantId_numeroAuxiliaire: {
          tenantId,
          numeroAuxiliaire: numeroAux,
        },
      },
    });

    if (existant) {
      throw new ConflictException(`L'auxiliaire ${numeroAux} existe déjà.`);
    }

    const created = await (this.prisma as any).comptaCompteAuxiliaire.create({
      data: {
        tenantId,
        compteCollectifId: compteCollectif.id,
        numeroAuxiliaire: numeroAux,
        libelle,
        tiersType,
        tiersReferenceExterne: dto.tiersReferenceExterne,
        statut: 'ACTIF',
        creePar: userId,
      },
      include: { compteCollectif: true },
    });

    return {
      ...created,
      codeAuxiliaire: created.numeroAuxiliaire,
      intitule: created.libelle,
      actif: created.statut === 'ACTIF',
      compteCollectifNumero: created.compteCollectif?.numeroCompte,
      compteCollectifIntitule: created.compteCollectif?.libelle,
    };
  }

  // ---------------- IMPORT EN MASSE DU PLAN COMPTABLE (EXCEL / CSV) ----------------

  async importPlanComptable(tenantId: string, dto: ImportPlanComptableDto, userId: string) {
    if (!dto.comptes || !Array.isArray(dto.comptes) || dto.comptes.length === 0) {
      throw new BadRequestException('Aucune ligne de compte fournie pour l’importation.');
    }

    if (dto.comptes.length > 3000) {
      throw new BadRequestException('Le fichier dépasse la limite autorisée de 3 000 comptes par import.');
    }

    const ecraser = dto.ecraserExistant !== false;
    let nbCrees = 0;
    let nbMisAJour = 0;
    let nbIgnores = 0;
    const erreurs: Array<{ ligne: number; numero: string; message: string }> = [];

    // Récupérer tous les comptes existants du tenant pour un traitement en mémoire ultra-rapide
    const comptesExistants = await (this.prisma as any).comptaCompte.findMany({
      where: { tenantId },
      select: { id: true, numeroCompte: true, libelle: true, statut: true, mouvemente: true },
    });
    const mapExistants = new Map<string, any>(
      comptesExistants.map((c: any) => [c.numeroCompte, c]),
    );

    for (let i = 0; i < dto.comptes.length; i++) {
      const ligneIndex = i + 1;
      const raw = dto.comptes[i];
      const rawNumero = (raw.numeroCompte || raw.numero || '').toString().trim();
      const numeroCompte = rawNumero.replace(/[\s.-]/g, '');
      const libelle = (raw.libelle || raw.intitule || '').toString().trim();

      if (!numeroCompte) {
        erreurs.push({ ligne: ligneIndex, numero: '', message: 'Numéro de compte manquant ou vide.' });
        continue;
      }

      if (numeroCompte.length < 2) {
        erreurs.push({ ligne: ligneIndex, numero: numeroCompte, message: 'Le numéro de compte doit comporter au moins 2 caractères.' });
        continue;
      }

      const premierCaractere = parseInt(numeroCompte.charAt(0), 10);
      const classe = raw.classe || (!isNaN(premierCaractere) && premierCaractere >= 1 && premierCaractere <= 9 ? premierCaractere : 1);

      // Règle EF-002 AUDCIF : Seule la classe 4 peut comporter des caractères alphanumériques
      if (classe !== 4 && !/^\d+$/.test(numeroCompte)) {
        erreurs.push({
          ligne: ligneIndex,
          numero: numeroCompte,
          message: 'Seuls les comptes de classe 4 peuvent comporter des lettres ou caractères alphanumériques (Règle EF-002 AUDCIF).',
        });
        continue;
      }

      if (!libelle) {
        erreurs.push({ ligne: ligneIndex, numero: numeroCompte, message: 'L’intitulé / libellé du compte est obligatoire.' });
        continue;
      }

      const statut = raw.actif === false ? 'DESACTIVE' : 'ACTIF';
      const existant = mapExistants.get(numeroCompte);

      if (existant) {
        if (ecraser) {
          await (this.prisma as any).comptaCompte.update({
            where: { id: existant.id },
            data: {
              libelle,
              statut: existant.mouvemente && statut === 'DESACTIVE' ? existant.statut : statut,
              modifiePar: userId,
            },
          });
          mapExistants.set(numeroCompte, { ...existant, libelle, statut });
          nbMisAJour++;
        } else {
          nbIgnores++;
        }
      } else {
        const nouveau = await (this.prisma as any).comptaCompte.create({
          data: {
            tenantId,
            numeroCompte,
            libelle,
            classe,
            statut,
            mouvemente: false,
            creePar: userId,
          },
        });
        mapExistants.set(numeroCompte, nouveau);
        nbCrees++;
      }
    }

    return {
      success: true,
      totalTraite: dto.comptes.length,
      crees: nbCrees,
      misAJour: nbMisAJour,
      ignores: nbIgnores,
      erreurs,
      message: `${nbCrees} compte(s) créé(s), ${nbMisAJour} mis à jour, ${nbIgnores} ignoré(s)${
        erreurs.length > 0 ? `, ${erreurs.length} ligne(s) en erreur` : ''
      }.`,
    };
  }
}
