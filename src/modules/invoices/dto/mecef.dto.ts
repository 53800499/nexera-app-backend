import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  InvoiceNormalizationStatus,
  MecefAibType,
  MecefEnvironment,
} from '../enums/mecef.enum';

export class NormalizeInvoiceDto {
  @ApiPropertyOptional({
    enum: MecefAibType,
    example: MecefAibType.A,
    description: 'Type AIB pour la normalisation (A=1% avec IFU, B=5% sans IFU, NONE=aucun)',
  })
  @IsEnum(MecefAibType)
  @IsOptional()
  aibType?: MecefAibType;

  @ApiPropertyOptional({
    example: 'Vente au comptant certifiée e-MECeF',
    description: 'Commentaire ou référence transmise avec la facture',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MecefTaxGroupBreakdownDto {
  @ApiProperty({ example: 100000, description: 'Base hors taxe soumise au groupe' })
  baseHt!: number;

  @ApiProperty({ example: 18000, description: 'Montant de TVA calculé sur ce groupe' })
  taxAmount!: number;

  @ApiProperty({ example: 18, description: 'Taux de taxe applicable en pourcentage' })
  rate!: number;
}

export class MecefDetailsResponseDto {
  @ApiProperty({
    enum: InvoiceNormalizationStatus,
    example: InvoiceNormalizationStatus.NORMALIZED,
    description: 'Statut du processus de certification fiscale',
  })
  normalizationStatus!: InvoiceNormalizationStatus;

  @ApiPropertyOptional({
    example: 'TEST01000001',
    description: "Numéro d'Identification de la Machine (NIM)",
  })
  mecefNim?: string | null;

  @ApiPropertyOptional({
    example: '12/45 FV',
    description: 'Compteurs séquentiels MC (Machine) / TC (Total)',
  })
  mecefCounters?: string | null;

  @ApiPropertyOptional({
    example: 'F12A-B34C-D56E-F78G-H90I',
    description: 'Code de sécurité / signature cryptographique DGI',
  })
  mecefCode?: string | null;

  @ApiPropertyOptional({
    example: 'https://mecef.impots.bj/verify/F12A-B34C-D56E-F78G-H90I',
    description: 'Contenu ou URL de vérification encodé dans le QR Code DGI',
  })
  mecefQrCodeData?: string | null;

  @ApiPropertyOptional({
    description: 'Ventilation des bases et taxes par groupe de taxation (A, B, C, D)',
  })
  mecefTaxGroupTotals?: Record<string, MecefTaxGroupBreakdownDto> | null;

  @ApiProperty({
    enum: MecefAibType,
    example: MecefAibType.NONE,
    description: 'Type AIB appliqué (NONE, A=1%, B=5%)',
  })
  mecefAibType!: MecefAibType;

  @ApiProperty({
    example: 0,
    description: "Montant de l'acompte AIB calculé sur la base HT",
  })
  mecefAibAmount!: number;

  @ApiPropertyOptional({
    description: 'Date et heure précises de la certification fiscale par la DGI',
  })
  mecefNormalizedAt?: Date | null;

  @ApiPropertyOptional({
    description: "Message ou code d'erreur retourné par l'API e-MECeF en cas de rejet",
  })
  mecefErrorMessage?: string | null;

  @ApiPropertyOptional({
    description: "Code MECeF de la facture d'origine (obligatoire pour un avoir / FA)",
  })
  originalMecefCode?: string | null;
}

export class UpdateMecefConfigDto {
  @ApiPropertyOptional({
    example: 'https://ebf.impots.bj/api',
    description: "URL de base de l'API e-MECeF DGI",
  })
  @IsString()
  @IsOptional()
  mecefApiUrl?: string;

  @ApiPropertyOptional({
    example: 'votre_cle_api_secrete_dgi',
    description: "Clé / Token d'authentification fourni par la DGI",
  })
  @IsString()
  @IsOptional()
  mecefApiKey?: string;

  @ApiPropertyOptional({
    example: 'TEST01000001',
    description: "Numéro d'Identification de la Machine (NIM) attribué",
  })
  @IsString()
  @IsOptional()
  mecefNim?: string;

  @ApiPropertyOptional({
    enum: MecefEnvironment,
    default: MecefEnvironment.SANDBOX,
    description: 'Environnement actif : sandbox (test) ou production',
  })
  @IsEnum(MecefEnvironment)
  @IsOptional()
  mecefEnvironment?: MecefEnvironment;

  @ApiPropertyOptional({
    default: false,
    description: "Normaliser automatiquement les factures lors de l'émission (statut issued)",
  })
  @IsBoolean()
  @IsOptional()
  mecefAutoNormalize?: boolean;
}

export class MecefConfigResponseDto {
  @ApiPropertyOptional({ example: 'https://ebf.impots.bj/api' })
  mecefApiUrl?: string | null;

  @ApiPropertyOptional({
    example: 'eyJh...****',
    description: 'Clé API masquée pour raison de sécurité',
  })
  mecefApiKeyMasked?: string | null;

  @ApiPropertyOptional({ example: 'TEST01000001' })
  mecefNim?: string | null;

  @ApiProperty({
    enum: MecefEnvironment,
    example: MecefEnvironment.SANDBOX,
  })
  mecefEnvironment!: MecefEnvironment;

  @ApiProperty({ example: false })
  mecefAutoNormalize!: boolean;

  @ApiProperty({
    example: true,
    description: 'Indique si les paramètres e-MECeF minimaux sont configurés pour certifier',
  })
  isConfigured!: boolean;
}
