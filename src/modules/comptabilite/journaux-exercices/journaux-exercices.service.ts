import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ClotureExerciceDto,
  CreateExerciceDto,
  CreateJournalDto,
  ReouvertureExerciceDto,
} from '../dto/compta.dto';

@Injectable()
export class JournauxExercicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- JOURNAUX ----------------

  async listJournaux(tenantId: string) {
    return (this.prisma as any).comptaJournal.findMany({
      where: { tenantId },
      include: { compteTresorerie: true },
      orderBy: { codeJournal: 'asc' },
    });
  }

  async createJournal(tenantId: string, dto: CreateJournalDto, userId: string) {
    const codeJournal = (dto.codeJournal || '').trim().toUpperCase();
    const typeJournal = (dto.typeJournal === 'OPERATIONS_DIVERSES' ? 'OD' : dto.typeJournal) as any;

    const existant = await (this.prisma as any).comptaJournal.findUnique({
      where: {
        tenantId_codeJournal: {
          tenantId,
          codeJournal,
        },
      },
    });

    if (existant) {
      throw new ConflictException(`Le journal ${codeJournal} existe déjà.`);
    }

    return (this.prisma as any).comptaJournal.create({
      data: {
        tenantId,
        codeJournal,
        libelle: dto.libelle,
        typeJournal,
        compteTresorerieId: dto.compteTresorerieId,
        moduleSourceDefaut: dto.moduleSourceDefaut,
        creePar: userId,
      },
      include: { compteTresorerie: true },
    });
  }

  // ---------------- EXERCICES & PÉRIODES ----------------

  private formatPeriode(p: any) {
    if (!p) return p;
    let numeroPeriode = p.numeroPeriode;
    let libelle = p.libelle;
    let dateDebut = p.dateDebut;
    let dateFin = p.dateFin;

    if (p.anneeMois) {
      const parts = String(p.anneeMois).split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        if (!numeroPeriode) numeroPeriode = m;
        const moisNoms = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
        ];
        if (!libelle) {
          libelle = `${moisNoms[m - 1] || 'Mois ' + m} ${y}`;
        }
        if (!dateDebut) {
          const mm = m < 10 ? `0${m}` : `${m}`;
          dateDebut = `${y}-${mm}-01`;
        }
        if (!dateFin) {
          const lastDay = new Date(y, m, 0).getDate();
          const mm = m < 10 ? `0${m}` : `${m}`;
          const dd = lastDay < 10 ? `0${lastDay}` : `${lastDay}`;
          dateFin = `${y}-${mm}-${dd}`;
        }
      }
    }

    return {
      ...p,
      numeroPeriode: numeroPeriode ?? 1,
      libelle: libelle ?? (p.anneeMois ? `Période ${p.anneeMois}` : 'Période 1'),
      dateDebut: dateDebut ? (typeof dateDebut === 'string' ? dateDebut : new Date(dateDebut).toISOString().substring(0, 10)) : '',
      dateFin: dateFin ? (typeof dateFin === 'string' ? dateFin : new Date(dateFin).toISOString().substring(0, 10)) : '',
    };
  }

  private formatExercice(ex: any) {
    if (!ex) return ex;
    return {
      ...ex,
      annee: ex.annee ?? (ex.dateDebut ? new Date(ex.dateDebut).getFullYear() : new Date().getFullYear()),
      periodes: Array.isArray(ex.periodes) ? ex.periodes.map((p: any) => this.formatPeriode(p)) : ex.periodes,
    };
  }

  async listExercices(tenantId: string) {
    const list = await (this.prisma as any).comptaExercice.findMany({
      where: { tenantId },
      include: {
        periodes: { orderBy: { anneeMois: 'asc' } },
        reouvertures: { orderBy: { dateReouverture: 'desc' } },
      },
      orderBy: { dateDebut: 'desc' },
    });
    return list.map((e: any) => this.formatExercice(e));
  }

  async getExerciceActif(tenantId: string) {
    let ex = await (this.prisma as any).comptaExercice.findFirst({
      where: { tenantId, statut: 'OUVERT' },
      include: {
        periodes: { orderBy: { anneeMois: 'asc' } },
      },
    });

    if (!ex) {
      ex = await (this.prisma as any).comptaExercice.findFirst({
        where: { tenantId },
        include: {
          periodes: { orderBy: { anneeMois: 'asc' } },
        },
        orderBy: { dateDebut: 'desc' },
      });
    }

    return this.formatExercice(ex);
  }

  async createExercice(tenantId: string, dto: CreateExerciceDto, userId: string) {
    const dDebut = new Date(dto.dateDebut);
    const dFin = new Date(dto.dateFin);

    if (dFin <= dDebut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début.');
    }

    const ex = await (this.prisma as any).comptaExercice.create({
      data: {
        tenantId,
        dateDebut: dDebut,
        dateFin: dFin,
        statut: 'OUVERT',
        systemeComptable: dto.systemeComptable || 'SN',
        systemeForceManuellement: dto.systemeForceManuellement || false,
        creePar: userId,
      },
    });

    // Générer les périodes mensuelles automatiquement
    const current = new Date(dDebut);
    while (current <= dFin) {
      const y = current.getFullYear();
      const m = current.getMonth() + 1;
      const anneeMois = `${y}-${m < 10 ? '0' + m : m}`;

      await (this.prisma as any).comptaPeriode.upsert({
        where: {
          exerciceId_anneeMois: {
            exerciceId: ex.id,
            anneeMois,
          },
        },
        update: {},
        create: {
          exerciceId: ex.id,
          anneeMois,
          statut: 'OUVERTE',
        },
      });

      current.setMonth(current.getMonth() + 1);
    }

    const created = await (this.prisma as any).comptaExercice.findUnique({
      where: { id: ex.id },
      include: { periodes: { orderBy: { anneeMois: 'asc' } } },
    });
    return this.formatExercice(created);
  }

  async cloturerPeriode(tenantId: string, periodeId: string, userId: string) {
    const periode = await (this.prisma as any).comptaPeriode.findUnique({
      where: { id: periodeId },
      include: { exercice: true },
    });

    if (!periode || periode.exercice.tenantId !== tenantId) {
      throw new NotFoundException('Période comptable introuvable.');
    }

    if (periode.statut === 'CLOTUREE') {
      throw new BadRequestException('Cette période est déjà clôturée.');
    }

    // Vérifier s'il reste des écritures en BROUILLON dans cette période
    const brouillons = await (this.prisma as any).comptaEcriture.count({
      where: {
        periodeId,
        statut: { in: ['BROUILLON', 'EN_ATTENTE_VALIDATION'] },
      },
    });

    if (brouillons > 0) {
      throw new BadRequestException(
        `Impossible de clôturer la période : ${brouillons} écriture(s) sont encore en brouillon ou en attente de validation.`,
      );
    }

    const updated = await (this.prisma as any).comptaPeriode.update({
      where: { id: periodeId },
      data: {
        statut: 'CLOTUREE',
        dateCloture: new Date(),
        cloturePar: userId,
      },
    });
    return this.formatPeriode(updated);
  }

  async cloturerExercice(tenantId: string, exerciceId: string, dto: ClotureExerciceDto, userId: string) {
    const ex = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
      include: { periodes: true },
    });

    if (!ex) {
      throw new NotFoundException('Exercice comptable introuvable.');
    }

    if (ex.statut === 'CLOTURE' || ex.statut === 'ARCHIVE') {
      throw new BadRequestException('Cet exercice est déjà clôturé.');
    }

    // Toutes les périodes doivent être clôturées
    const periodesOuvertes = ex.periodes.filter((p: any) => p.statut === 'OUVERTE');
    if (periodesOuvertes.length > 0) {
      throw new BadRequestException(
        `Impossible de clôturer l'exercice : ${periodesOuvertes.length} période(s) sont encore ouvertes.`,
      );
    }

    // Calcul automatique du résultat net si non fourni (Total Produits classe 7 - Total Charges classe 6)
    let resultatCalcule = dto.resultatNet;
    if (resultatCalcule === undefined) {
      const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
        where: {
          ecriture: {
            exerciceId,
            statut: 'VALIDEE',
          },
        },
        include: { compte: true },
      });

      let totalCharges = 0; // Classe 6
      let totalProduits = 0; // Classe 7

      for (const l of lignes) {
        if (l.compte.classe === 6) {
          totalCharges += Number(l.montantDebit) - Number(l.montantCredit);
        } else if (l.compte.classe === 7) {
          totalProduits += Number(l.montantCredit) - Number(l.montantDebit);
        }
      }

      resultatCalcule = totalProduits - totalCharges;
    }

    const updated = await (this.prisma as any).comptaExercice.update({
      where: { id: exerciceId },
      data: {
        statut: 'CLOTURE',
        dateCloture: new Date(),
        resultatNet: resultatCalcule,
        modifiePar: userId,
      },
      include: {
        periodes: { orderBy: { anneeMois: 'asc' } },
        reouvertures: { orderBy: { dateReouverture: 'desc' } },
      },
    });
    return this.formatExercice(updated);
  }

  /**
   * UC-13 : Rouvrir un exercice clôturé pour régularisation (encadré par motif)
   */
  async rouvrirExercice(tenantId: string, exerciceId: string, dto: ReouvertureExerciceDto, userId: string) {
    const ex = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
    });

    if (!ex) {
      throw new NotFoundException('Exercice comptable introuvable.');
    }

    if (ex.statut === 'ARCHIVE') {
      throw new ForbiddenException(
        'Règle EF-014 : Un exercice archivé définitivement ne peut plus jamais être rouvert.',
      );
    }

    if (ex.statut !== 'CLOTURE') {
      throw new BadRequestException('Seul un exercice clôturé peut être rouvert pour régularisation.');
    }

    // Trace dans compta_reouverture_exercice
    await (this.prisma as any).comptaReouvertureExercice.create({
      data: {
        exerciceId,
        periodeId: dto.periodeId,
        motif: dto.motif,
        autorisePar: userId,
        dateReouverture: new Date(),
      },
    });

    // Rouvrir temporairement la période ciblée
    await (this.prisma as any).comptaPeriode.update({
      where: { id: dto.periodeId },
      data: { statut: 'OUVERTE', dateCloture: null, cloturePar: null },
    });

    // Passer l'exercice en EN_CLOTURE
    const updated = await (this.prisma as any).comptaExercice.update({
      where: { id: exerciceId },
      data: {
        statut: 'EN_CLOTURE',
        modifiePar: userId,
      },
      include: {
        periodes: { orderBy: { anneeMois: 'asc' } },
        reouvertures: { orderBy: { dateReouverture: 'desc' } },
      },
    });
    return this.formatExercice(updated);
  }

  /**
   * UC-14 : Archiver définitivement un exercice
   */
  async archiverExercice(tenantId: string, exerciceId: string, userId: string) {
    const ex = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
    });

    if (!ex) {
      throw new NotFoundException('Exercice introuvable.');
    }

    if (ex.statut !== 'CLOTURE') {
      throw new BadRequestException('Un exercice doit être clôturé avant d’être archivé définitivement.');
    }

    // Calcul de l'empreinte SHA-256 de scellement
    const ecritures = await (this.prisma as any).comptaEcriture.findMany({
      where: { exerciceId, statut: 'VALIDEE' },
      include: { lignes: { orderBy: { ordre: 'asc' } } },
      orderBy: { numEcriture: 'asc' },
    });

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(ecritures))
      .digest('hex');

    const updated = await (this.prisma as any).comptaExercice.update({
      where: { id: exerciceId },
      data: {
        statut: 'ARCHIVE',
        dateArchivage: new Date(),
        fecHashArchivage: hash,
        modifiePar: userId,
      },
      include: {
        periodes: { orderBy: { anneeMois: 'asc' } },
      },
    });
    return this.formatExercice(updated);
  }
}
