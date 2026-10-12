import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class FecService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC-18 : Générer le Fichier des Écritures Comptables (FEC)
   * Conforme à l'Arrêté N°1085/MEF/CAB/SGM/DGI/DLC (Bénin / UEMOA)
   */
  async genererFec(
    tenantId: string,
    exerciceId: string,
    options: {
      format?: 'CSV' | 'TXT_TAB' | 'TXT_PIPE';
      motifGeneration?: 'A_LA_DEMANDE' | 'ARCHIVAGE' | 'CONTROLE_FISCAL';
    },
    userId: string,
  ) {
    const exercice = await (this.prisma as any).comptaExercice.findFirst({
      where: { id: exerciceId, tenantId },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable.');
    }

    // Récupérer le tenant et ses paramètres pour l'IFU
    const [tenant, settings] = await Promise.all([
      (this.prisma as any).tenant.findUnique({ where: { id: tenantId } }),
      (this.prisma as any).tenantSettings.findUnique({ where: { tenantId } }).catch(() => null),
    ]);

    const ifu =
      settings?.taxIdNumber ||
      settings?.ifu ||
      tenant?.taxIdNumber ||
      tenant?.registrationNumber ||
      '0000000000000';

    // Récupérer toutes les lignes d'écritures VALIDEE de l'exercice
    const lignes = await (this.prisma as any).comptaEcritureLigne.findMany({
      where: {
        ecriture: {
          tenantId,
          exerciceId,
          statut: 'VALIDEE',
        },
      },
      include: {
        compte: true,
        compteAuxiliaire: true,
        lettrage: true,
        ecriture: {
          include: {
            journal: true,
            validations: {
              where: { decision: 'VALIDEE' },
              orderBy: { decideLe: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { ecriture: { dateEcriture: 'asc' } },
        { ecriture: { numEcriture: 'asc' } },
        { ordre: 'asc' },
      ],
    });

    if (lignes.length === 0) {
      throw new BadRequestException(
        'Aucune écriture validée trouvée pour cet exercice.',
      );
    }

    const separateur =
      options.format === 'TXT_TAB' ? '\t' : options.format === 'TXT_PIPE' ? '|' : ';';

    const header = [
      'JournalCode',
      'JournalLib',
      'EcritureNum',
      'EcritureDate',
      'CompteNum',
      'CompteLib',
      'CompAuxNum',
      'CompAuxLib',
      'PieceRef',
      'PieceDate',
      'EcritureLib',
      'Debit',
      'Credit',
      'EcritureLet',
      'DateLet',
      'ValidDate',
      'Montantdevise',
      'Idevise',
    ].join(separateur);

    const rows: string[] = [header];

    for (const l of lignes) {
      const e = l.ecriture;
      const j = e.journal;
      const c = l.compte;
      const aux = l.compteAuxiliaire;
      const lettrage = l.lettrage;
      const validDate =
        e.validations && e.validations[0] ? e.validations[0].decideLe : e.modifieLe || e.creeLe;

      const formatDate = (d: any) =>
        d ? new Date(d).toISOString().substring(0, 10).replace(/-/g, '') : '';

      const debit = Number(l.montantDebit || 0).toFixed(2);
      const credit = Number(l.montantCredit || 0).toFixed(2);

      const row = [
        j.codeJournal,
        j.libelle.replace(/[;\t|]/g, ' '),
        e.numEcriture || '',
        formatDate(e.dateEcriture),
        c?.numeroCompte || '',
        (c?.libelle || '').replace(/[;\t|]/g, ' '),
        aux ? aux.numeroAuxiliaire : '',
        aux ? (aux.libelle || '').replace(/[;\t|]/g, ' ') : '',
        e.refPiece ? e.refPiece.replace(/[;\t|]/g, ' ') : '',
        formatDate(e.datePiece || e.dateEcriture),
        (l.libelleLigne || e.libelle).replace(/[;\t|]/g, ' '),
        debit,
        credit,
        lettrage ? lettrage.codeLettre : '',
        lettrage ? formatDate(lettrage.lettreLe) : '',
        formatDate(validDate),
        l.montantDevise ? Number(l.montantDevise).toFixed(2) : '',
        l.codeDevise || '',
      ].join(separateur);

      rows.push(row);
    }

    const fileContent = rows.join('\r\n');

    // Empreinte d'intégrité SHA-256 (EF-056)
    const hash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');

    // Nom de fichier légal : FEC_IFU_AAAAMMJJ.txt
    const dateClotureStr = exercice.dateFin
      ? new Date(exercice.dateFin).toISOString().substring(0, 10).replace(/-/g, '')
      : `${exercice.annee}1231`;

    const nomFichier = `FEC_${ifu}_${dateClotureStr}.${options.format === 'CSV' ? 'csv' : 'txt'}`;

    // Sauvegarder dans compta_fec_export
    const exportRecord = await (this.prisma as any).comptaFecExport.create({
      data: {
        tenantId,
        exerciceId,
        ifu,
        nomFichier,
        nombreFichiers: 1,
        format: options.format === 'TXT_TAB' ? 'TXT_TAB' : options.format === 'TXT_PIPE' ? 'TXT_PIPE' : 'CSV',
        jeuCaracteres: 'ASCII',
        nombreLignes: lignes.length,
        scelle: exercice.statut === 'ARCHIVE',
        empreinteSha256: hash,
        motifGeneration: options.motifGeneration || 'A_LA_DEMANDE',
        generePar: userId,
      },
    });

    return {
      exportId: exportRecord.id,
      nomFichier,
      nombreLignes: lignes.length,
      empreinteSha256: hash,
      genereLe: exportRecord.genereLe,
      fileContent,
    };
  }

  /**
   * Lister l'historique des exports FEC
   */
  async getHistoriqueExports(tenantId: string, exerciceId?: string) {
    const where: any = { tenantId };
    if (exerciceId) where.exerciceId = exerciceId;

    return (this.prisma as any).comptaFecExport.findMany({
      where,
      include: { exercice: true },
      orderBy: { genereLe: 'desc' },
    });
  }
}
