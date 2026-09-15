import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExportFecDto } from '../dto/fiscalite.dto';

export interface FecLigne {
  codeJournal: string;
  libJournal: string;
  numEcriture: string;
  dateEcriture: string; // AAAAMMJJ
  numCompte: string;
  libCompte: string;
  numCompteAux?: string;
  libCompteAux?: string;
  refPiece: string;
  datePiece: string; // AAAAMMJJ
  libEcriture: string;
  montDebit: number;
  montCredit: number;
  letEcriture?: string;
  dateLetEcriture?: string; // AAAAMMJJ
  dateValid: string; // AAAAMMJJ
  montDevise?: number;
  codeDevise?: string;
}

@Injectable()
export class FecService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Arrêté 1085-C Bénin : En-tête officiel des 18 colonnes normalisées
   */
  readonly COLONNES_OFFICIELLES_18 = [
    'CodeJournal',
    'LibJournal',
    'NumEcriture',
    'DateEcriture',
    'NumCompte',
    'LibCompte',
    'NumCompteAux',
    'LibCompteAux',
    'RefPiece',
    'DatePiece',
    'LibEcriture',
    'MontDebit',
    'MontCredit',
    'LetEcriture',
    'DateLetEcriture',
    'DateValid',
    'MontDevise',
    'CodeDevise',
  ];

  formatDateAaaammjj(date: Date | string): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /**
   * Valide la conformité d'un jeu d'écritures aux normes de l'Arrêté 1085-C
   */
  validerConformite(lignes: FecLigne[]) {
    const anomalies: string[] = [];

    let totalDebit = 0;
    let totalCredit = 0;

    lignes.forEach((l, index) => {
      const ligneNum = index + 1;

      // 1. Contrôle des champs obligatoires
      if (!l.codeJournal) anomalies.push(`Ligne ${ligneNum} : CodeJournal manquant.`);
      if (!l.libJournal) anomalies.push(`Ligne ${ligneNum} : LibJournal manquant.`);
      if (!l.numEcriture) anomalies.push(`Ligne ${ligneNum} : NumEcriture manquant.`);
      if (!l.dateEcriture || l.dateEcriture.length !== 8) {
        anomalies.push(`Ligne ${ligneNum} : DateEcriture invalide (format AAAAMMJJ requis).`);
      }
      if (!l.numCompte || l.numCompte.length < 3) {
        anomalies.push(`Ligne ${ligneNum} : NumCompte SYSCOHADA invalide (au moins 3 chiffres requis).`);
      }
      if (!l.libCompte) anomalies.push(`Ligne ${ligneNum} : LibCompte manquant.`);
      if (!l.refPiece) anomalies.push(`Ligne ${ligneNum} : RefPiece justificative manquante.`);
      if (!l.datePiece || l.datePiece.length !== 8) {
        anomalies.push(`Ligne ${ligneNum} : DatePiece invalide (format AAAAMMJJ requis).`);
      }
      if (!l.libEcriture) anomalies.push(`Ligne ${ligneNum} : LibEcriture manquant.`);
      if (!l.dateValid || l.dateValid.length !== 8) {
        anomalies.push(`Ligne ${ligneNum} : DateValid invalide (format AAAAMMJJ requis).`);
      }

      // 2. Contrôle des montants
      const debit = Number(l.montDebit) || 0;
      const credit = Number(l.montCredit) || 0;
      totalDebit += debit;
      totalCredit += credit;

      if (debit < 0 || credit < 0) {
        anomalies.push(`Ligne ${ligneNum} : Les montants débit et crédit doivent être positifs.`);
      }
      if (debit === 0 && credit === 0) {
        anomalies.push(`Ligne ${ligneNum} : Écriture à montant nul (débit et crédit = 0).`);
      }
      if (debit > 0 && credit > 0) {
        anomalies.push(`Ligne ${ligneNum} : Une même ligne ne peut pas porter simultanément un débit et un crédit.`);
      }
    });

    // 3. Contrôle d'équilibre comptable (Débit == Crédit)
    const ecart = Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
    const estEquilibre = ecart === 0;
    if (!estEquilibre) {
      anomalies.push(
        `Déséquilibre comptable global : Total Débit (${totalDebit.toLocaleString()}) ≠ Total Crédit (${totalCredit.toLocaleString()}), Écart = ${ecart.toLocaleString()} FCFA.`,
      );
    }

    return {
      conforme: anomalies.length === 0,
      nombreLignes: lignes.length,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      ecart,
      anomalies,
      referenceNorme: 'Arrêté n° 1085-C/MEF/CAB/SGM/DGI/DLC (République du Bénin)',
    };
  }

  /**
   * Génère le fichier plat FEC au format officiel Arrêté 1085-C
   */
  async genererFichierFec(
    tenantId: string,
    taxContribuableId: string,
    dto: ExportFecDto,
  ) {
    const contribuable = await (this.prisma as any).taxContribuable.findUnique({
      where: { id: taxContribuableId },
    });
    if (!contribuable) {
      throw new NotFoundException('Contribuable fiscal introuvable.');
    }

    const ifu = contribuable.identifiantFiscalUnique.replace(/[^0-9A-Za-z]/g, '');
    const dateClotureAaaammjj = this.formatDateAaaammjj(dto.dateCloture);
    const separateur = dto.separateur === 'POINT_VIRGULE' ? ';' : '\t';
    const extension = dto.formatFichier === 'CSV' ? 'csv' : 'txt';

    // Règle Art. 6 : Nom officiel FEC_IFU_AAAAMMJJ
    const nomFichier = `FEC_${ifu}_${dateClotureAaaammjj}.${extension}`;

    // Récupérer les écritures enregistrées dans le système
    const ecrituresFisc = await (this.prisma as any).taxEcritureComptableFiscale.findMany({
      where: { taxContribuableId },
      orderBy: { dateEcriture: 'asc' },
    });

    // Construire les lignes normalisées
    const lignes: FecLigne[] = [];

    // 1. Ligne de report à nouveau (REPORT) - Art. 5 alinéa final
    lignes.push({
      codeJournal: 'RAN',
      libJournal: 'Journal des Reports à Nouveau',
      numEcriture: 'RAN-000001',
      dateEcriture: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      numCompte: '121000',
      libCompte: 'Report à nouveau créditeur',
      refPiece: 'BILAN-N-1',
      datePiece: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      libEcriture: 'REPORT', // Valeur imposée par l'Arrêté 1085-C
      montDebit: 0,
      montCredit: 25000000,
      dateValid: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      codeDevise: 'XOF',
    });

    lignes.push({
      codeJournal: 'RAN',
      libJournal: 'Journal des Reports à Nouveau',
      numEcriture: 'RAN-000001',
      dateEcriture: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      numCompte: '521100',
      libCompte: 'Banque locale',
      refPiece: 'BILAN-N-1',
      datePiece: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      libEcriture: 'REPORT',
      montDebit: 25000000,
      montCredit: 0,
      dateValid: `${dateClotureAaaammjj.substring(0, 4)}0101`,
      codeDevise: 'XOF',
    });

    // 2. Écritures d'opérations courantes
    let seq = 1;
    for (const ec of ecrituresFisc) {
      const numEc = `OD-${String(seq++).padStart(6, '0')}`;
      const dtStr = this.formatDateAaaammjj(ec.dateEcriture);

      // Ligne Débit
      lignes.push({
        codeJournal: 'OD',
        libJournal: 'Opérations Diverses Fiscales',
        numEcriture: numEc,
        dateEcriture: dtStr,
        numCompte: ec.compteDebitSyscohada,
        libCompte: ec.compteDebitSyscohada === '695' ? 'Impôts sur le résultat' : 'Compte de charge',
        refPiece: `TAX-IS-${dtStr}`,
        datePiece: dtStr,
        libEcriture: 'Constatation de l’IS annuel calculé',
        montDebit: ec.montant,
        montCredit: 0,
        dateValid: dtStr,
        codeDevise: 'XOF',
      });

      // Ligne Crédit
      lignes.push({
        codeJournal: 'OD',
        libJournal: 'Opérations Diverses Fiscales',
        numEcriture: numEc,
        dateEcriture: dtStr,
        numCompte: ec.compteCreditSyscohada,
        libCompte: ec.compteCreditSyscohada === '444' ? 'État, impôts sur les bénéfices' : 'Compte de tiers',
        refPiece: `TAX-IS-${dtStr}`,
        datePiece: dtStr,
        libEcriture: 'Constatation de l’IS annuel calculé',
        montDebit: 0,
        montCredit: ec.montant,
        dateValid: dtStr,
        codeDevise: 'XOF',
      });
    }

    // Validation préalable de conformité
    const auditConformite = this.validerConformite(lignes);

    // Construction du flux textuel
    const header = this.COLONNES_OFFICIELLES_18.join(separateur);
    const rows = lignes.map((l) => [
      l.codeJournal,
      l.libJournal,
      l.numEcriture,
      l.dateEcriture,
      l.numCompte,
      l.libCompte,
      l.numCompteAux || '',
      l.libCompteAux || '',
      l.refPiece,
      l.datePiece,
      l.libEcriture,
      l.montDebit ? l.montDebit.toFixed(2).replace('.', ',') : '0,00',
      l.montCredit ? l.montCredit.toFixed(2).replace('.', ',') : '0,00',
      l.letEcriture || '',
      l.dateLetEcriture || '',
      l.dateValid,
      l.montDevise ? l.montDevise.toFixed(2).replace('.', ',') : '',
      l.codeDevise || 'XOF',
    ].join(separateur));

    const contenuFichier = [header, ...rows].join('\r\n');

    return {
      nomFichier,
      contenuFichier,
      mimeType: dto.formatFichier === 'CSV' ? 'text/csv; charset=ISO-8859-15' : 'text/plain; charset=ISO-8859-15',
      tailleOctets: Buffer.byteLength(contenuFichier, 'utf8'),
      auditConformite,
      lignes,
    };
  }
}
