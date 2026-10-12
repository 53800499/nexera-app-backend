import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompteDto {
  @ApiPropertyOptional({ example: '4111', description: 'Numéro de compte (jusqu’à 13 car.)' })
  @IsOptional()
  @IsString()
  @Length(1, 13)
  numeroCompte?: string;

  @ApiPropertyOptional({ example: '4111', description: 'Alias numéro de compte' })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional({ example: 'Clients - Ventes locales', description: 'Libellé du compte' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ example: 'Clients - Ventes locales', description: 'Alias intitulé du compte' })
  @IsOptional()
  @IsString()
  intitule?: string;

  @ApiPropertyOptional({ example: 4, description: 'Classe SYSCOHADA (1 à 9)' })
  @IsOptional()
  @IsInt()
  classe?: number;

  @ApiPropertyOptional({ description: 'Sens attendu (DEBITEUR, CREDITEUR)' })
  @IsOptional()
  @IsString()
  sensAttendu?: string;

  @ApiPropertyOptional({ description: 'Actif ou non' })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({ description: 'ID du compte modèle SYSCOHADA d’origine' })
  @IsOptional()
  @IsString()
  modeleId?: string;
}

export class UpdateCompteDto {
  @ApiPropertyOptional({ example: 'Clients - Ventes nationales' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ example: 'Clients - Ventes nationales' })
  @IsOptional()
  @IsString()
  intitule?: string;

  @ApiPropertyOptional({ description: 'Sens attendu' })
  @IsOptional()
  @IsString()
  sensAttendu?: string;

  @ApiPropertyOptional({ description: 'Actif ou non' })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({ example: 'ARCHIVE', enum: ['ACTIF', 'DESACTIVE', 'ARCHIVE'] })
  @IsOptional()
  @IsIn(['ACTIF', 'DESACTIVE', 'ARCHIVE'])
  statut?: 'ACTIF' | 'DESACTIVE' | 'ARCHIVE';
}

export class CreateCompteAuxiliaireDto {
  @ApiProperty({ description: 'ID du compte collectif (ex: 411, 401)' })
  @IsString()
  compteCollectifId: string;

  @ApiPropertyOptional({ example: '411CLI001', description: 'Numéro auxiliaire alphanumérique' })
  @IsOptional()
  @IsString()
  @Length(1, 13)
  numeroAuxiliaire?: string;

  @ApiPropertyOptional({ example: '411CLI001', description: 'Code auxiliaire alias' })
  @IsOptional()
  @IsString()
  codeAuxiliaire?: string;

  @ApiPropertyOptional({ example: 'Société Bénin Télécom SA' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ example: 'Société Bénin Télécom SA' })
  @IsOptional()
  @IsString()
  intitule?: string;

  @ApiPropertyOptional({ example: 'CLIENT', enum: ['CLIENT', 'FOURNISSEUR', 'SALARIE', 'AUTRE'] })
  @IsOptional()
  @IsString()
  tiersType?: string;

  @ApiPropertyOptional({ example: 'CLIENT' })
  @IsOptional()
  @IsString()
  typeTiers?: string;

  @ApiPropertyOptional({ description: 'Référence externe (ID client/fournisseur dans CRM/M1)' })
  @IsOptional()
  @IsString()
  tiersReferenceExterne?: string;
}

export class CreateJournalDto {
  @ApiProperty({ example: 'VE', description: 'Code journal (max 5 car.)' })
  @IsString()
  @Length(1, 5)
  codeJournal: string;

  @ApiProperty({ example: 'Journal des Ventes' })
  @IsString()
  libelle: string;

  @ApiProperty({ example: 'VENTES' })
  @IsString()
  typeJournal: string;

  @ApiPropertyOptional({ description: 'Compte de trésorerie de classe 5 rattaché' })
  @IsOptional()
  @IsString()
  compteTresorerieId?: string;

  @ApiPropertyOptional({ description: 'Module amont par défaut (M1, M2, M4, M5)' })
  @IsOptional()
  @IsString()
  moduleSourceDefaut?: string;
}

export class CreateExerciceDto {
  @ApiPropertyOptional({ example: 2026, description: 'Année de l’exercice' })
  @IsOptional()
  @IsInt()
  annee?: number;

  @ApiProperty({ example: '2026-01-01', description: 'Date de début d’exercice' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2026-12-31', description: 'Date de fin d’exercice' })
  @IsDateString()
  dateFin: string;

  @ApiPropertyOptional({ example: 'SN', enum: ['SN', 'SMT'] })
  @IsOptional()
  @IsIn(['SN', 'SMT'])
  systemeComptable?: 'SN' | 'SMT';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  systemeForceManuellement?: boolean;
}

export class ClotureExerciceDto {
  @ApiPropertyOptional({ example: 12500000, description: 'Résultat net calculé' })
  @IsOptional()
  @IsNumber()
  resultatNet?: number;
}

export class ReouvertureExerciceDto {
  @ApiProperty({ description: 'ID de la période à régulariser' })
  @IsString()
  periodeId: string;

  @ApiProperty({ example: 'Régularisation facture fournisseur omise n° FAC-2026-089' })
  @IsString()
  motif: string;
}

export class CreateEcritureLigneDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  ordre: number;

  @ApiProperty({ description: 'ID du compte comptable' })
  @IsString()
  compteId: string;

  @ApiPropertyOptional({ description: 'ID du compte auxiliaire de tiers le cas échéant' })
  @IsOptional()
  @IsString()
  compteAuxiliaireId?: string;

  @ApiPropertyOptional({ example: 'Facture vente F-2026-001 - Client Delta' })
  @IsOptional()
  @IsString()
  libelleLigne?: string;

  @ApiPropertyOptional({ example: 118000 })
  @IsOptional()
  @IsNumber()
  montantDebit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  montantCredit?: number;

  @ApiPropertyOptional({ example: 'XOF' })
  @IsOptional()
  @IsString()
  codeDevise?: string;

  @ApiPropertyOptional({ description: 'ID section analytique optionnelle' })
  @IsOptional()
  @IsString()
  sectionAnalytiqueId?: string;
}

export class CreateEcritureDto {
  @ApiPropertyOptional({ description: 'ID de l’exercice comptable' })
  @IsOptional()
  @IsString()
  exerciceId?: string;

  @ApiPropertyOptional({ description: 'ID de la période comptable' })
  @IsOptional()
  @IsString()
  periodeId?: string;

  @ApiProperty({ description: 'ID du journal comptable' })
  @IsString()
  journalId: string;

  @ApiProperty({ example: '2026-03-15', description: 'Date de l’écriture' })
  @IsDateString()
  dateEcriture: string;

  @ApiPropertyOptional({ example: 'FAC-2026-015', description: 'Référence de la pièce justificative' })
  @IsOptional()
  @IsString()
  refPiece?: string;

  @ApiPropertyOptional({ example: 'FAC-2026-015', description: 'Référence de la pièce justificative (alias pieceRef)' })
  @IsOptional()
  @IsString()
  pieceRef?: string;

  @ApiPropertyOptional({ example: '2026-03-10' })
  @IsOptional()
  @IsDateString()
  datePiece?: string;

  @ApiProperty({ example: 'Prestation de conseil et maintenance informatique' })
  @IsString()
  libelle: string;

  @ApiPropertyOptional({ example: 'MANUELLE', enum: ['MANUELLE', 'MODELE', 'MOTEUR_REGLES', 'M4', 'M5', 'M7', 'IMPORT_HISTORIQUE'] })
  @IsOptional()
  @IsIn(['MANUELLE', 'MODELE', 'MOTEUR_REGLES', 'M4', 'M5', 'M7', 'IMPORT_HISTORIQUE'])
  origine?: 'MANUELLE' | 'MODELE' | 'MOTEUR_REGLES' | 'M4' | 'M5' | 'M7' | 'IMPORT_HISTORIQUE';

  @ApiPropertyOptional({ description: 'Soumettre directement pour validation' })
  @IsOptional()
  @IsBoolean()
  soumettreValidation?: boolean;

  @ApiProperty({ type: [CreateEcritureLigneDto], description: 'Lignes d’écriture (doivent être équilibrées)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEcritureLigneDto)
  lignes: CreateEcritureLigneDto[];
}

export class ValidationDecisionDto {
  @ApiProperty({ example: 'VALIDEE', enum: ['VALIDEE', 'REJETEE'] })
  @IsIn(['VALIDEE', 'REJETEE'])
  decision: 'VALIDEE' | 'REJETEE';

  @ApiPropertyOptional({ example: 'Compte de TVA déductible erroné' })
  @IsOptional()
  @IsString()
  motifRejet?: string;
}

export class ValidationLotDto {
  @ApiProperty({ type: [String], description: 'Liste des IDs d’écritures à valider en masse' })
  @IsArray()
  @IsString({ each: true })
  ecritureIds: string[];

  @ApiProperty({ example: 'VALIDEE', enum: ['VALIDEE', 'REJETEE'] })
  @IsIn(['VALIDEE', 'REJETEE'])
  decision: 'VALIDEE' | 'REJETEE';

  @ApiPropertyOptional({ example: 'Validation lot fin de mois' })
  @IsOptional()
  @IsString()
  motif?: string;
}

export class CreateLettrageDto {
  @ApiProperty({ description: 'ID du compte auxiliaire de tiers' })
  @IsString()
  compteAuxiliaireId: string;

  @ApiProperty({ type: [String], description: 'IDs des lignes d’écritures se soldant mutuellement' })
  @IsArray()
  @IsString({ each: true })
  ecritureLigneIds: string[];
}

export class ImportReleveBancaireLigneDto {
  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  dateOperation: string;

  @ApiProperty({ example: 'Virement reçu Client Delta' })
  @IsString()
  libelle: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  montant: number;

  @ApiPropertyOptional({ example: 'VIR-BNP-0012984' })
  @IsOptional()
  @IsString()
  referenceBancaire?: string;
}

export class ImportReleveBancaireDto {
  @ApiProperty({ description: 'ID du journal de banque' })
  @IsString()
  journalId: string;

  @ApiProperty({ example: 'CSV', enum: ['CSV', 'OFX', 'MT940'] })
  @IsIn(['CSV', 'OFX', 'MT940'])
  formatSource: 'CSV' | 'OFX' | 'MT940';

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  dateFin: string;

  @ApiPropertyOptional({ example: 5200000 })
  @IsOptional()
  @IsNumber()
  soldeOuverture?: number;

  @ApiPropertyOptional({ example: 6700000 })
  @IsOptional()
  @IsNumber()
  soldeCloture?: number;

  @ApiProperty({ type: [ImportReleveBancaireLigneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportReleveBancaireLigneDto)
  lignes: ImportReleveBancaireLigneDto[];
}

export class RapprochementManuelDto {
  @ApiProperty({ description: 'ID de la ligne de relevé bancaire' })
  @IsString()
  ligneReleveId: string;

  @ApiProperty({ description: 'ID de la ligne d’écriture comptable de trésorerie' })
  @IsString()
  ecritureLigneId: string;
}

export class GenerateFecDto {
  @ApiProperty({ description: 'ID de l’exercice comptable (clôturé ou archivé)' })
  @IsString()
  exerciceId: string;

  @ApiProperty({ example: '0202612345678', description: 'IFU du contribuable' })
  @IsString()
  ifu: string;

  @ApiPropertyOptional({ example: 'TXT', enum: ['CSV', 'TXT'] })
  @IsOptional()
  @IsIn(['CSV', 'TXT'])
  format?: 'CSV' | 'TXT';

  @ApiPropertyOptional({ example: 'ASCII', enum: ['ASCII', 'ISO_8859_15', 'EBCDIC'] })
  @IsOptional()
  @IsIn(['ASCII', 'ISO_8859_15', 'EBCDIC'])
  jeuCaracteres?: 'ASCII' | 'ISO_8859_15' | 'EBCDIC';

  @ApiPropertyOptional({ example: false, description: 'Comptabilité de trésorerie (ajoute les 3 champs règlement)' })
  @IsOptional()
  @IsBoolean()
  comptabiliteTresorerie?: boolean;

  @ApiPropertyOptional({ example: 'A_LA_DEMANDE', enum: ['ARCHIVAGE', 'CONTROLE_FISCAL', 'A_LA_DEMANDE'] })
  @IsOptional()
  @IsIn(['ARCHIVAGE', 'CONTROLE_FISCAL', 'A_LA_DEMANDE'])
  motifGeneration?: 'ARCHIVAGE' | 'CONTROLE_FISCAL' | 'A_LA_DEMANDE';
}

export class GenerateEtatFinancierDto {
  @ApiProperty({ description: 'ID de l’exercice' })
  @IsString()
  exerciceId: string;

  @ApiPropertyOptional({ example: 'SN', enum: ['SN', 'SMT'] })
  @IsOptional()
  @IsIn(['SN', 'SMT'])
  systemeComptable?: 'SN' | 'SMT';

  @ApiPropertyOptional({ example: 'PROVISOIRE', enum: ['PROVISOIRE', 'DEFINITIVE'] })
  @IsOptional()
  @IsIn(['PROVISOIRE', 'DEFINITIVE'])
  typeEdition?: 'PROVISOIRE' | 'DEFINITIVE';
}
