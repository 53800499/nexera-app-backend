import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QualifySourceReglementaireDto {
  @ApiProperty({ enum: ['QUALIFIEE', 'PARAMETRAGE_EN_COURS', 'APPLIQUEE', 'SANS_IMPACT_LOGICIEL'] })
  @IsIn(['QUALIFIEE', 'PARAMETRAGE_EN_COURS', 'APPLIQUEE', 'SANS_IMPACT_LOGICIEL'])
  statutVeille: 'QUALIFIEE' | 'PARAMETRAGE_EN_COURS' | 'APPLIQUEE' | 'SANS_IMPACT_LOGICIEL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resume?: string;
}

export class CreateSourceReglementaireDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  @IsNotEmpty()
  paysCode: string;

  @ApiProperty({ enum: ['LOI_FINANCES', 'CODE_GENERAL_IMPOTS', 'ARRETE', 'CIRCULAIRE', 'NOTE_ADMINISTRATIVE', 'DECISION_JUSTICE', 'AUTRE'] })
  @IsIn(['LOI_FINANCES', 'CODE_GENERAL_IMPOTS', 'ARRETE', 'CIRCULAIRE', 'NOTE_ADMINISTRATIVE', 'DECISION_JUSTICE', 'AUTRE'])
  typeSource: 'LOI_FINANCES' | 'CODE_GENERAL_IMPOTS' | 'ARRETE' | 'CIRCULAIRE' | 'NOTE_ADMINISTRATIVE' | 'DECISION_JUSTICE' | 'AUTRE';

  @ApiProperty({ example: 'CGI Bénin 2026, Art. 46' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ example: 'Taux de l’impôt sur les sociétés gestion 2026' })
  @IsString()
  @IsNotEmpty()
  titre: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  datePublication: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateEntreeVigueur: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resume?: string;
}

export class CreateTaxBaremeDto {
  @ApiProperty()
  @IsUUID()
  taxTypeId: string;

  @ApiProperty()
  @IsUUID()
  sourceReglementaireId: string;

  @ApiProperty({ example: 'Barème IS Bénin 2026 — Secteur industriel' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ example: 'industriel' })
  @IsOptional()
  @IsString()
  secteurActivite?: string;

  @ApiPropertyOptional({ example: 25.0 })
  @IsOptional()
  @IsNumber()
  tauxDefaut?: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class ValidateTaxBaremeDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  aNecessiteRecalculRetroactif?: boolean;
}

export class UpdateSourceReglementaireDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titre?: string;

  @ApiPropertyOptional({ enum: ['LOI_FINANCES', 'CODE_GENERAL_IMPOTS', 'ARRETE', 'CIRCULAIRE', 'NOTE_ADMINISTRATIVE', 'DECISION_JUSTICE', 'AUTRE'] })
  @IsOptional()
  @IsIn(['LOI_FINANCES', 'CODE_GENERAL_IMPOTS', 'ARRETE', 'CIRCULAIRE', 'NOTE_ADMINISTRATIVE', 'DECISION_JUSTICE', 'AUTRE'])
  typeSource?: 'LOI_FINANCES' | 'CODE_GENERAL_IMPOTS' | 'ARRETE' | 'CIRCULAIRE' | 'NOTE_ADMINISTRATIVE' | 'DECISION_JUSTICE' | 'AUTRE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  datePublication?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateEntreeVigueur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resume?: string;

  @ApiPropertyOptional({ enum: ['A_QUALIFIER', 'QUALIFIEE', 'PARAMETRAGE_EN_COURS', 'APPLIQUEE', 'SANS_IMPACT_LOGICIEL'] })
  @IsOptional()
  @IsIn(['A_QUALIFIER', 'QUALIFIEE', 'PARAMETRAGE_EN_COURS', 'APPLIQUEE', 'SANS_IMPACT_LOGICIEL'])
  statutVeille?: 'A_QUALIFIER' | 'QUALIFIEE' | 'PARAMETRAGE_EN_COURS' | 'APPLIQUEE' | 'SANS_IMPACT_LOGICIEL';
}

export class UpdateTaxBaremeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secteurActivite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tauxDefaut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReglementaireId?: string;

  @ApiPropertyOptional({ enum: ['BROUILLON', 'VALIDE', 'ACTIF', 'REMPLACE'] })
  @IsOptional()
  @IsIn(['BROUILLON', 'VALIDE', 'ACTIF', 'REMPLACE'])
  statut?: 'BROUILLON' | 'VALIDE' | 'ACTIF' | 'REMPLACE';
}

export class CreateTaxParametrePaysDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  @IsNotEmpty()
  paysCode: string;

  @ApiProperty({ example: 'SEUIL_CA_TVA_NORMAL' })
  @IsString()
  @IsNotEmpty()
  codeParametre: string;

  @ApiProperty({ example: 'Seuil de chiffre d\'affaires pour assujettissement obligatoire à la TVA' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ enum: ['NUMERIQUE', 'TEXTE', 'BOOLEEN', 'POURCENTAGE'], default: 'NUMERIQUE' })
  @IsOptional()
  @IsIn(['NUMERIQUE', 'TEXTE', 'BOOLEEN', 'POURCENTAGE'])
  typeValeur?: 'NUMERIQUE' | 'TEXTE' | 'BOOLEEN' | 'POURCENTAGE';

  @ApiProperty({ example: '50000000' })
  @IsString()
  @IsNotEmpty()
  valeur: string;

  @ApiPropertyOptional({ example: 'FCFA' })
  @IsOptional()
  @IsString()
  unite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReglementaireId?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class UpdateTaxParametrePaysDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ enum: ['NUMERIQUE', 'TEXTE', 'BOOLEEN', 'POURCENTAGE'] })
  @IsOptional()
  @IsIn(['NUMERIQUE', 'TEXTE', 'BOOLEEN', 'POURCENTAGE'])
  typeValeur?: 'NUMERIQUE' | 'TEXTE' | 'BOOLEEN' | 'POURCENTAGE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valeur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReglementaireId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class CreateTaxRegimeDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  @IsNotEmpty()
  paysCode: string;

  @ApiProperty({ example: 'RSI' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Régime Simplifié d\'Imposition' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @IsNumber()
  seuilChiffreAffairesMax?: number;

  @ApiPropertyOptional({ enum: ['COMPTABILITE_COMPLETE', 'COMPTABILITE_SIMPLIFIEE', 'DECLARATION_FORFAITAIRE'], default: 'COMPTABILITE_SIMPLIFIEE' })
  @IsOptional()
  @IsIn(['COMPTABILITE_COMPLETE', 'COMPTABILITE_SIMPLIFIEE', 'DECLARATION_FORFAITAIRE'])
  obligationComptable?: 'COMPTABILITE_COMPLETE' | 'COMPTABILITE_SIMPLIFIEE' | 'DECLARATION_FORFAITAIRE';

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class UpdateTaxRegimeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  seuilChiffreAffairesMax?: number;

  @ApiPropertyOptional({ enum: ['COMPTABILITE_COMPLETE', 'COMPTABILITE_SIMPLIFIEE', 'DECLARATION_FORFAITAIRE'] })
  @IsOptional()
  @IsIn(['COMPTABILITE_COMPLETE', 'COMPTABILITE_SIMPLIFIEE', 'DECLARATION_FORFAITAIRE'])
  obligationComptable?: 'COMPTABILITE_COMPLETE' | 'COMPTABILITE_SIMPLIFIEE' | 'DECLARATION_FORFAITAIRE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFinValidite?: string;
}

export class CreateContribuableDto {
  @ApiProperty()
  @IsUUID()
  etablissementRefId: string;

  @ApiProperty({ example: 'BJ' })
  @IsString()
  paysCode: string;

  @ApiProperty({ example: '3201912345678' })
  @IsString()
  identifiantFiscalUnique: string;

  @ApiPropertyOptional({ example: 'commerce' })
  @IsOptional()
  @IsString()
  secteurActivite?: string;

  @ApiPropertyOptional({ example: '1ère zone' })
  @IsOptional()
  @IsString()
  zoneAdministrative?: string;

  @ApiProperty()
  @IsUUID()
  regimeImpositionId: string;

  @ApiPropertyOptional({ example: 'Centre des Impôts des Moyennes Entreprises Littoral 1' })
  @IsOptional()
  @IsString()
  centreImpotsRattachement?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  assujettiTva?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  assujettiIs?: boolean;
}

export class UpdateContribuableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identifiantFiscalUnique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secteurActivite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zoneAdministrative?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regimeImpositionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  centreImpotsRattachement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  assujettiTva?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  assujettiIs?: boolean;
}

export class CreateDeclarationTvaDto {
  @ApiProperty()
  @IsUUID()
  taxContribuableId: string;

  @ApiProperty({ example: '2026-03' })
  @IsString()
  @IsNotEmpty()
  periode: string;

  @ApiProperty({ example: '2026-04-10' })
  @IsDateString()
  dateLimiteLegale: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  creditTvaAnterieur?: number;
}

export class CreateLigneTvaDto {
  @ApiProperty({ enum: ['VENTE_TAXABLE', 'VENTE_EXONEREE', 'ACHAT_DEDUCTIBLE', 'IMPORTATION', 'NOTE_FRAIS_DEDUCTIBLE'] })
  @IsIn(['VENTE_TAXABLE', 'VENTE_EXONEREE', 'ACHAT_DEDUCTIBLE', 'IMPORTATION', 'NOTE_FRAIS_DEDUCTIBLE'])
  nature: 'VENTE_TAXABLE' | 'VENTE_EXONEREE' | 'ACHAT_DEDUCTIBLE' | 'IMPORTATION' | 'NOTE_FRAIS_DEDUCTIBLE';

  @ApiProperty({ example: 18.0 })
  @IsNumber()
  tauxApplique: number;

  @ApiProperty({ example: 10000000 })
  @IsNumber()
  baseHorsTaxe: number;

  @ApiProperty({ example: 1800000 })
  @IsNumber()
  montantTva: number;
}

export class SimulerCalculAibDto {
  @ApiProperty({ enum: ['IMPORTATION', 'ACHAT_COMMERCIAL_IFU', 'PRESTATION_SERVICE_IFU', 'ACHAT_NON_IMMATRICULE'] })
  @IsIn(['IMPORTATION', 'ACHAT_COMMERCIAL_IFU', 'PRESTATION_SERVICE_IFU', 'ACHAT_NON_IMMATRICULE'])
  natureOperation: 'IMPORTATION' | 'ACHAT_COMMERCIAL_IFU' | 'PRESTATION_SERVICE_IFU' | 'ACHAT_NON_IMMATRICULE';

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  base: number;
}

export class SimulerCalculIsDto {
  @ApiProperty({ example: 45000000 })
  @IsNumber()
  resultatComptableNet: number;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  reintegrations: number;

  @ApiProperty({ example: 2000000 })
  @IsNumber()
  deductions: number;

  @ApiProperty({ example: 250000000 })
  @IsNumber()
  produitsEncaissables: number;

  @ApiPropertyOptional({ example: 'autres' })
  @IsOptional()
  @IsString()
  secteurActivite?: string;
}

export class CreateRetraitementDto {
  @ApiProperty({ enum: ['REINTEGRATION', 'DEDUCTION'] })
  @IsIn(['REINTEGRATION', 'DEDUCTION'])
  sens: 'REINTEGRATION' | 'DEDUCTION';

  @ApiProperty({ example: 'Amortissement excédentaire véhicule de tourisme' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  montant: number;

  @ApiPropertyOptional({ example: 'CGI Art. 48' })
  @IsOptional()
  @IsString()
  baseLegale?: string;
}

export class CreateExerciceFiscalDto {
  @ApiProperty()
  @IsUUID()
  taxContribuableId: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dateFin: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exerciceComptableRefId?: string;
}

export class ExportFecDto {
  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dateCloture: string;

  @ApiPropertyOptional({ enum: ['TABULATION', 'POINT_VIRGULE'], default: 'TABULATION' })
  @IsOptional()
  @IsIn(['TABULATION', 'POINT_VIRGULE'])
  separateur?: 'TABULATION' | 'POINT_VIRGULE';

  @ApiPropertyOptional({ enum: ['CSV', 'TXT'], default: 'TXT' })
  @IsOptional()
  @IsIn(['CSV', 'TXT'])
  formatFichier?: 'CSV' | 'TXT';
}

export class CreerControleFiscalDto {
  @ApiProperty()
  @IsUUID()
  taxContribuableId: string;

  @ApiProperty({ enum: ['SUR_PIECES', 'SUR_PLACE', 'PONCTUEL'] })
  @IsIn(['SUR_PIECES', 'SUR_PLACE', 'PONCTUEL'])
  typeControle: 'SUR_PIECES' | 'SUR_PLACE' | 'PONCTUEL';

  @ApiPropertyOptional({ example: '2026-02-15' })
  @IsOptional()
  @IsDateString()
  dateAvisVerification?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  periodeControleeDebut?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  periodeControleeFin?: string;

  @ApiPropertyOptional({ example: 'Direction des Grandes Entreprises - Brigade 2' })
  @IsOptional()
  @IsString()
  serviceEnCharge?: string;
}

export class NotifierRedressementDto {
  @ApiProperty()
  @IsUUID()
  taxTypeId: string;

  @ApiProperty({ example: 'Exercice 2024' })
  @IsString()
  exerciceOuPeriodeConcerne: string;

  @ApiProperty({ example: 'Remise en cause de la déductibilité de provisions' })
  @IsString()
  motif: string;

  @ApiProperty({ example: 4500000 })
  @IsNumber()
  montantDroitsReclames: number;

  @ApiPropertyOptional({ example: 900000 })
  @IsOptional()
  @IsNumber()
  montantPenalitesReclamees?: number;
}

export class IntroduireRecoursDto {
  @ApiProperty()
  @IsUUID()
  taxContribuableId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  redressementId?: string;

  @ApiProperty({ enum: ['RECLAMATION_PREALABLE', 'RECOURS_HIERARCHIQUE', 'RECOURS_JURIDICTIONNEL', 'DEMANDE_GRACIEUSE'] })
  @IsIn(['RECLAMATION_PREALABLE', 'RECOURS_HIERARCHIQUE', 'RECOURS_JURIDICTIONNEL', 'DEMANDE_GRACIEUSE'])
  typeRecours: 'RECLAMATION_PREALABLE' | 'RECOURS_HIERARCHIQUE' | 'RECOURS_JURIDICTIONNEL' | 'DEMANDE_GRACIEUSE';

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  dateDepot: string;

  @ApiProperty({ example: 'Contestation du rejet des provisions pour dépréciation' })
  @IsString()
  objet: string;
}

export class EstimerPenaliteDto {
  @ApiProperty({ enum: ['RETARD_DECLARATION', 'INSUFFISANCE_DECLARATION', 'RETARD_PAIEMENT', 'INTERET_RETARD'] })
  @IsIn(['RETARD_DECLARATION', 'INSUFFISANCE_DECLARATION', 'RETARD_PAIEMENT', 'INTERET_RETARD'])
  typePenalite: 'RETARD_DECLARATION' | 'INSUFFISANCE_DECLARATION' | 'RETARD_PAIEMENT' | 'INTERET_RETARD';

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  baseCalcul: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  nbMoisRetard?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  apresMiseEnDemeure?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mauvaiseFoi?: boolean;
}
