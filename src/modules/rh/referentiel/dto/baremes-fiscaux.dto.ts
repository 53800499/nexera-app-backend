import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RhItsCalculationModeEnum {
  PROGRESSIF_PAR_TRANCHE = 'PROGRESSIF_PAR_TRANCHE',
  TAUX_UNIQUE = 'TAUX_UNIQUE',
  QUOTIENT_FAMILIAL = 'QUOTIENT_FAMILIAL',
}

export enum RhAssiettePeriodicityEnum {
  MENSUELLE = 'MENSUELLE',
  ANNUELLE = 'ANNUELLE',
}

export enum RhAssietteTypeEnum {
  SALAIRE_BRUT = 'SALAIRE_BRUT',
  SALAIRE_BRUT_PLAFONNE = 'SALAIRE_BRUT_PLAFONNE',
  SALAIRE_NET_IMPOSABLE = 'SALAIRE_NET_IMPOSABLE',
  NET_A_PAYER = 'NET_A_PAYER',
  FORFAIT = 'FORFAIT',
}

export enum RhSocialChargeShareEnum {
  SALARIALE = 'SALARIALE',
  PATRONALE = 'PATRONALE',
  MIXTE = 'MIXTE',
}

export enum RhBenefitInKindTypeEnum {
  LOGEMENT = 'LOGEMENT',
  VEHICULE = 'VEHICULE',
  NOURRITURE = 'NOURRITURE',
  DOMESTIQUE = 'DOMESTIQUE',
  EAU_ELECTRICITE = 'EAU_ELECTRICITE',
  TELEPHONE = 'TELEPHONE',
  AUTRE = 'AUTRE',
}

export enum RhCountryParamValueTypeEnum {
  NOMBRE = 'NOMBRE',
  TEXTE = 'TEXTE',
  BOOLEEN = 'BOOLEEN',
  DATE = 'DATE',
  JSON = 'JSON',
}

export class CreateBaremeTrancheDto {
  @ApiProperty({ example: 1, description: 'Numéro d’ordre de la tranche' })
  @IsNumber()
  @Min(1)
  numeroTranche: number;

  @ApiProperty({ example: 0, description: 'Seuil plancher de la tranche en devise locale' })
  @IsNumber()
  @Min(0)
  limiteInferieure: number;

  @ApiPropertyOptional({ example: 50000, description: 'Seuil plafond de la tranche (null si dernière tranche illimitée)' })
  @IsOptional()
  @IsNumber()
  limiteSuperieure?: number | null;

  @ApiProperty({ example: 10, description: 'Taux marginal d’imposition en pourcentage' })
  @IsNumber()
  @Min(0)
  taux: number;

  @ApiPropertyOptional({ example: 5000, description: 'Déduction fixe pour calcul rapide (formule R*t - D)' })
  @IsOptional()
  @IsNumber()
  montantDeductionFixe?: number;
}

export class UpdateBaremeTrancheDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  numeroTranche?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  limiteInferieure?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  limiteSuperieure?: number | null;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  taux?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  montantDeductionFixe?: number;
}

export class CreateBaremeItsDto {
  @ApiProperty({ example: 'BJ', description: 'Code ISO2 du pays' })
  @IsString()
  paysCode: string;

  @ApiProperty({ example: 'ITS', description: 'Code de l’impôt (ex: ITS, IRPP)' })
  @IsString()
  codeImpot: string;

  @ApiProperty({ example: 'Barème Progressif ITS Bénin 2026 (CGI Art. 125)', description: 'Libellé descriptif' })
  @IsString()
  libelle: string;

  @ApiProperty({ enum: RhItsCalculationModeEnum, default: RhItsCalculationModeEnum.PROGRESSIF_PAR_TRANCHE })
  @IsEnum(RhItsCalculationModeEnum)
  modeCalcul: RhItsCalculationModeEnum;

  @ApiPropertyOptional({ enum: RhAssiettePeriodicityEnum, default: RhAssiettePeriodicityEnum.MENSUELLE })
  @IsOptional()
  @IsEnum(RhAssiettePeriodicityEnum)
  periodiciteAssiette?: RhAssiettePeriodicityEnum;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', description: 'Date de début d’application légale' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Date de fin d’application légale' })
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;

  @ApiPropertyOptional({ type: [CreateBaremeTrancheDto], description: 'Tranches initiales du barème' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBaremeTrancheDto)
  tranches?: CreateBaremeTrancheDto[];
}

export class UpdateBaremeItsDto {
  @ApiPropertyOptional({ example: 'BJ', description: 'Code ISO2 du pays' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ example: 'ITS', description: 'Code de l’impôt (ex: ITS, IRPP)' })
  @IsOptional()
  @IsString()
  codeImpot?: string;

  @ApiPropertyOptional({ example: 'Barème ITS 2026 Révisé' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ enum: RhItsCalculationModeEnum })
  @IsOptional()
  @IsEnum(RhItsCalculationModeEnum)
  modeCalcul?: RhItsCalculationModeEnum;

  @ApiPropertyOptional({ enum: RhAssiettePeriodicityEnum })
  @IsOptional()
  @IsEnum(RhAssiettePeriodicityEnum)
  periodiciteAssiette?: RhAssiettePeriodicityEnum;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;
}

export class DuplicateBaremeItsDto {
  @ApiProperty({ example: 'Barème Progressif ITS Bénin 2027 (CGI Art. 125)' })
  @IsString()
  nouveauLibelle: string;

  @ApiProperty({ example: '2027-01-01T00:00:00.000Z' })
  @IsDateString()
  nouvelleDateDebut: string;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.000Z' })
  @IsOptional()
  @ValidateIf((o) => o.nouvelleDateFin !== null && o.nouvelleDateFin !== undefined && o.nouvelleDateFin !== '')
  @IsDateString()
  nouvelleDateFin?: string;
}

export class ReplaceTranchesBatchDto {
  @ApiProperty({ type: [CreateBaremeTrancheDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBaremeTrancheDto)
  tranches: CreateBaremeTrancheDto[];
}

export class CreateSocialChargeDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  paysCode: string;

  @ApiProperty({ example: 'VPS_PATRONAL_BENIN' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Versement Patronal sur Salaires (VPS 4% CGI 2026)' })
  @IsString()
  libelle: string;

  @ApiPropertyOptional({ enum: RhAssietteTypeEnum, default: RhAssietteTypeEnum.SALAIRE_BRUT })
  @IsOptional()
  @IsEnum(RhAssietteTypeEnum)
  typeAssiette?: RhAssietteTypeEnum;

  @ApiPropertyOptional({ enum: RhSocialChargeShareEnum, default: RhSocialChargeShareEnum.PATRONALE })
  @IsOptional()
  @IsEnum(RhSocialChargeShareEnum)
  partSalariale?: RhSocialChargeShareEnum;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  tauxSalarial?: number;

  @ApiPropertyOptional({ example: 4.0, default: 0 })
  @IsOptional()
  @IsNumber()
  tauxPatronal?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsNumber()
  montantFixe?: number | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsNumber()
  plafondMensuel?: number | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsNumber()
  plancherMensuel?: number | null;

  @ApiPropertyOptional({ example: 'DGI Bénin' })
  @IsOptional()
  @IsString()
  organismeCollecteur?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class UpdateSocialChargeDto {
  @ApiPropertyOptional({ example: 'BJ' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ example: 'VPS_PATRONAL_BENIN' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Versement Patronal sur Salaires' })
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ enum: RhAssietteTypeEnum })
  @IsOptional()
  @IsEnum(RhAssietteTypeEnum)
  typeAssiette?: RhAssietteTypeEnum;

  @ApiPropertyOptional({ enum: RhSocialChargeShareEnum })
  @IsOptional()
  @IsEnum(RhSocialChargeShareEnum)
  partSalariale?: RhSocialChargeShareEnum;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  tauxSalarial?: number;

  @ApiPropertyOptional({ example: 4.0 })
  @IsOptional()
  @IsNumber()
  tauxPatronal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  montantFixe?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plafondMensuel?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plancherMensuel?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organismeCollecteur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CreateAvantageNatureDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  paysCode: string;

  @ApiProperty({ enum: RhBenefitInKindTypeEnum, example: RhBenefitInKindTypeEnum.LOGEMENT })
  @IsEnum(RhBenefitInKindTypeEnum)
  typeAvantage: RhBenefitInKindTypeEnum;

  @ApiPropertyOptional({ example: 15, description: 'Taux forfaitaire en pourcentage du salaire de base' })
  @IsOptional()
  @IsNumber()
  tauxPourcentage?: number | null;

  @ApiPropertyOptional({ example: 50000, description: 'Montant forfaitaire mensuel en FCFA' })
  @IsOptional()
  @IsNumber()
  montantFixe?: number | null;

  @ApiPropertyOptional({ example: 'Logement de fonction meublé (CGI Bénin Art. 123)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Conditions d’attribution ou règles spécifiques JSON (ex: cadres vs employés)' })
  @IsOptional()
  conditionsJson?: any;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;
}

export class UpdateAvantageNatureDto {
  @ApiPropertyOptional({ example: 'BJ' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ enum: RhBenefitInKindTypeEnum })
  @IsOptional()
  @IsEnum(RhBenefitInKindTypeEnum)
  typeAvantage?: RhBenefitInKindTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tauxPourcentage?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  montantFixe?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  conditionsJson?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;
}

export class CreateCountryParamDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  paysCode: string;

  @ApiProperty({ example: 'SMIG_MENSUEL' })
  @IsString()
  codeParametre: string;

  @ApiProperty({ example: 'Salaire Minimum Interprofessionnel Garanti (SMIG)' })
  @IsString()
  libelle: string;

  @ApiProperty({ enum: RhCountryParamValueTypeEnum, example: RhCountryParamValueTypeEnum.NOMBRE })
  @IsEnum(RhCountryParamValueTypeEnum)
  typeValeur: RhCountryParamValueTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valeurTexte?: string;

  @ApiPropertyOptional({ example: 52000 })
  @IsOptional()
  @IsNumber()
  valeurNumerique?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valeurDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  valeurJson?: any;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  dateDebutValidite: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;
}

export class UpdateCountryParamDto {
  @ApiPropertyOptional({ example: 'BJ' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ example: 'SMIG_MENSUEL' })
  @IsOptional()
  @IsString()
  codeParametre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ enum: RhCountryParamValueTypeEnum })
  @IsOptional()
  @IsEnum(RhCountryParamValueTypeEnum)
  typeValeur?: RhCountryParamValueTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valeurTexte?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valeurNumerique?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valeurDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  valeurJson?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebutValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.dateFinValidite !== null && o.dateFinValidite !== undefined && o.dateFinValidite !== '')
  @IsDateString()
  dateFinValidite?: string | null;
}

export class SimulateurFiscalDto {
  @ApiPropertyOptional({ example: 350000, description: 'Salaire brut mensuel' })
  @IsOptional()
  @IsNumber()
  salaireBrut?: number;

  @ApiPropertyOptional({ example: 300000, description: 'Assiette nette imposable (si déjà calculée)' })
  @IsOptional()
  @IsNumber()
  salaireNetImposable?: number;

  @ApiPropertyOptional({ description: 'ID spécifique du barème ITS à tester (optionnel, prend le barème actif si omis)' })
  @IsOptional()
  @IsString()
  baremeItsId?: string;

  @ApiPropertyOptional({ example: 'BJ', default: 'BJ' })
  @IsOptional()
  @IsString()
  paysCode?: string;

  @ApiPropertyOptional({ example: 3, description: 'Mois (1-12) pour tester redevance ORTB Bénin (mars/juin)' })
  @IsOptional()
  @IsNumber()
  mois?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inclureCnss?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inclureVps?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inclureOrtb?: boolean;

  @ApiPropertyOptional({ example: 4.0, description: 'Taux VPS patronal (4% standard, 2% enseignement privé)' })
  @IsOptional()
  @IsNumber()
  tauxVps?: number;
}
