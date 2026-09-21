import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  RhPayrollRubricType,
  RhRubricDirection,
  RhPayrollCycleStatus,
  RhPayslipStatus,
  RhExceptionalPaymentType,
  RhSeveranceSignatureStatus,
} from '@prisma/client';

export class CreateRubriquePaieDto {
  @ApiProperty({ example: 'BJ' })
  @IsString()
  @IsNotEmpty()
  paysCode: string;

  @ApiProperty({ example: 'R155' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Prime d’Astreinte' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiProperty({ enum: RhPayrollRubricType, default: RhPayrollRubricType.GAIN_BRUT })
  @IsEnum(RhPayrollRubricType)
  @IsNotEmpty()
  typeRubrique: RhPayrollRubricType;

  @ApiPropertyOptional({ enum: RhRubricDirection, default: RhRubricDirection.GAIN })
  @IsEnum(RhRubricDirection)
  @IsOptional()
  sensDefaut?: RhRubricDirection;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  assujettiIts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  assujettiCnss?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  assujettiVps?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  formuleCalcul?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsInt()
  @IsOptional()
  ordreAffichage?: number;

  @ApiPropertyOptional({ example: '661200' })
  @IsString()
  @IsOptional()
  compteComptableCharge?: string;

  @ApiPropertyOptional({ example: '421000' })
  @IsString()
  @IsOptional()
  compteComptableTiers?: string;
}

export class UpdateRubriquePaieDto extends PartialType(CreateRubriquePaieDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

export class OpenCyclePaieDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  etablissementId: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @IsNotEmpty()
  annee: number;

  @ApiProperty({ example: 6, description: '1 à 12' })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsNotEmpty()
  mois: number;

  @ApiPropertyOptional({ example: 'CYC-2026-06' })
  @IsString()
  @IsOptional()
  codeCycle?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsDateString()
  @IsOptional()
  datePaiementPrevue?: string;
}

export class CreateElementVariableDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  rubriquePaieId: string;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @IsOptional()
  base?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @IsOptional()
  taux?: number;

  @ApiProperty({ example: 50000, description: 'Montant de la prime ou de la retenue' })
  @IsNumber()
  @IsNotEmpty()
  montant: number;

  @ApiPropertyOptional({ example: 'Prime exceptionnelle projet X' })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

export class BatchElementVariableDto {
  @ApiProperty({ type: [CreateElementVariableDto] })
  @IsNotEmpty()
  elements: CreateElementVariableDto[];
}

export class CalculateCyclePaieDto {
  @ApiPropertyOptional({ description: 'Si fourni, calcule uniquement cet employé' })
  @IsUUID()
  @IsOptional()
  employeId?: string;
}

export class CreateRemunerationExceptionnelleDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiProperty({ enum: RhExceptionalPaymentType, default: RhExceptionalPaymentType.TREIZIEME_MOIS })
  @IsEnum(RhExceptionalPaymentType)
  @IsNotEmpty()
  typeRemuneration: RhExceptionalPaymentType;

  @ApiProperty({ example: 350000, description: 'Montant brut de la rémunération exceptionnelle' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  montantBrut: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @IsNotEmpty()
  anneeConcernee: number;

  @ApiPropertyOptional({ example: 12, default: 12 })
  @IsInt()
  @IsOptional()
  periodeAcquisitionMois?: number;

  @ApiPropertyOptional({ example: 25, description: 'Taux d’abattement appliqué (ex: 25% Art. 126 CGI Bénin)' })
  @IsNumber()
  @IsOptional()
  tauxAbattementApplique?: number;
}

export class CreateSoldeToutCompteDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  employeId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  contratRuptureId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bulletinPaieId?: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  @IsNotEmpty()
  dateEtablissement: string;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @IsOptional()
  montantDernierSalaireNet?: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @IsOptional()
  montantIndemnitePreavisNet?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsNumber()
  @IsOptional()
  montantIndemniteLicenciementNet?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsNumber()
  @IsOptional()
  montantIndemniteCongesPayesNet?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  montantRetenuesDiverses?: number;
}

export class SignerSoldeToutCompteDto {
  @ApiProperty({ enum: RhSeveranceSignatureStatus, default: RhSeveranceSignatureStatus.SIGNE_SANS_RESERVE })
  @IsEnum(RhSeveranceSignatureStatus)
  @IsNotEmpty()
  statutSignature: RhSeveranceSignatureStatus;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  recuPourSoldeSigne?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  certificatTravailGenere?: boolean;
}
