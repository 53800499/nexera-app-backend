import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { NumberingDocumentType } from '../enums/numbering-document-type.enum';
import { EmailTemplateType } from '../enums/email-template-type.enum';
import { ExchangeRateSource } from '@prisma/client';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ example: 'EUR' })
  @IsString()
  @IsOptional()
  primaryCurrency?: string;

  @ApiPropertyOptional({ enum: ExchangeRateSource })
  @IsEnum(ExchangeRateSource)
  @IsOptional()
  exchangeRateSource?: ExchangeRateSource;

  @ApiPropertyOptional({ example: 10, description: 'Taux annuel pénalités de retard (%)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  latePaymentPenaltyRate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  latePaymentPenaltyText?: string;

  @ApiPropertyOptional({ description: 'Raison sociale vendeur' })
  @IsString()
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  siret?: string;

  @ApiPropertyOptional({ description: 'N° TVA intracommunautaire' })
  @IsString()
  @IsOptional()
  vatNumber?: string;

  @ApiPropertyOptional({ description: 'RCS / immatriculation' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiPropertyOptional({ example: '10 000 EUR' })
  @IsString()
  @IsOptional()
  shareCapital?: string;

  @ApiPropertyOptional({ description: 'Adresse siège (JSON)' })
  @IsOptional()
  companyAddress?: Record<string, string>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyWebsite?: string;

  @ApiPropertyOptional({ example: 'Virement, chèque, CB' })
  @IsString()
  @IsOptional()
  acceptedPaymentMethods?: string;

  @ApiPropertyOptional({ description: 'CGV affichées sur les PDF' })
  @IsString()
  @IsOptional()
  cgvText?: string;
}

export class CreateTaxRateDto {
  @ApiProperty({ example: 'TVA 18%' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  rate!: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateTaxRateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  rate?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreatePaymentTermDto {
  @ApiProperty({ example: '30 jours' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  days!: number;

  @ApiPropertyOptional({ description: '30 jours fin de mois' })
  @IsBoolean()
  @IsOptional()
  endOfMonth?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdatePaymentTermDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  days?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  endOfMonth?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateTenantCurrencyDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'US Dollar' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '$' })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiPropertyOptional({ description: 'Taux vs devise principale (manuel)' })
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  manualRate?: number;
}

export class UpdateTenantCurrencyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  manualRate?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateNumberingRuleDto {
  @ApiPropertyOptional({ example: 'FAC' })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  suffix?: string;

  @ApiPropertyOptional({ example: '-' })
  @IsString()
  @IsOptional()
  separator?: string;

  @ApiPropertyOptional({ example: 'DRAFT' })
  @IsString()
  @IsOptional()
  draftMarker?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeYear?: boolean;

  @ApiPropertyOptional({ example: 6 })
  @IsInt()
  @Min(3)
  @IsOptional()
  counterLength?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  annualReset?: boolean;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Variables : {{documentNumber}}, {{clientName}}, etc.' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePdfTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#1a56db' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#6b7280' })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @ApiPropertyOptional({
    enum: ['classic', 'modern', 'minimal'],
    description: 'Mise en page (3 modèles disponibles)',
  })
  @IsString()
  @IsOptional()
  layoutType?: 'classic' | 'modern' | 'minimal';

  @ApiPropertyOptional({ description: 'Numérotation Page X/Y' })
  @IsBoolean()
  @IsOptional()
  showPageNumbers?: boolean;

  @ApiPropertyOptional({
    example: 'Helvetica',
    description: 'Helvetica, Times-Roman ou Courier',
  })
  @IsString()
  @IsOptional()
  fontFamily?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headerText?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  footerText?: string;

  @ApiPropertyOptional({ description: 'Mentions légales affichées sur les PDF' })
  @IsString()
  @IsOptional()
  legalMentions?: string;

  @ApiPropertyOptional({ description: 'CGV complémentaires sur le PDF' })
  @IsString()
  @IsOptional()
  termsAndConditions?: string;
}

export { NumberingDocumentType, EmailTemplateType };
