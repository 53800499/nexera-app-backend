import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { CreateContactDto } from './create-contact.dto';

export enum ClientTypeDto {
  company = 'company',
  individual = 'individual',
}

export class CreateClientDto {
  @ApiProperty({ enum: ClientTypeDto, description: 'Type : entreprise ou particulier' })
  @IsEnum(ClientTypeDto)
  @IsNotEmpty()
  clientType!: ClientTypeDto;

  @ApiProperty({ description: 'Raison sociale ou nom (obligatoire — RM-C02)' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({
    description:
      'Contact principal (obligatoire à la création — RM-C02). Au moins prénom et nom.',
  })
  @ValidateNested()
  @Type(() => CreateContactDto)
  primaryContact!: CreateContactDto;

  @ApiProperty({
    description:
      'Adresse de facturation JSON (obligatoire — RM-C02). Ex: {"street":"...","city":"..."}',
  })
  @IsString()
  @IsNotEmpty()
  billingAddress!: string;

  @ApiPropertyOptional({ description: 'Nom commercial' })
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiPropertyOptional({ description: 'RCCM / SIRET — utilisé pour la détection de doublon (RM-C03)' })
  @IsString()
  @IsOptional()
  siret?: string;

  @ApiPropertyOptional({ description: 'IFU / identifiant fiscal — détection de doublon (RM-C03)' })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiPropertyOptional({ description: 'Adresse de livraison (JSON)' })
  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @ApiPropertyOptional({ default: 'EUR', description: 'Devise par défaut' })
  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Conditions de paiement par défaut' })
  @IsString()
  @IsOptional()
  defaultPaymentTermId?: string;

  @ApiPropertyOptional({ description: 'Taux de remise par défaut (%)' })
  @IsNumber()
  @IsOptional()
  defaultDiscountPct?: number;

  @ApiPropertyOptional({ description: "Plafond d'encours" })
  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Désactiver les relances automatiques (client VIP, accord de paiement en cours)',
  })
  @IsBoolean()
  @IsOptional()
  remindersDisabled?: boolean;

  @ApiPropertyOptional({ description: 'Motif de désactivation des relances' })
  @IsString()
  @IsOptional()
  remindersDisabledReason?: string;

  @ApiPropertyOptional({
    description:
      'Confirmer la création malgré un doublon détecté (SIRET / IFU / email — RM-C03)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  confirmDuplicate?: boolean;
}
