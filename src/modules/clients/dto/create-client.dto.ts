import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';

export enum ClientTypeDto {
  company = 'company',
  individual = 'individual',
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(ClientTypeDto)
  @IsNotEmpty()
  clientType!: ClientTypeDto;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsOptional()
  tradeName?: string;

  @IsString()
  @IsOptional()
  siret?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  sector?: string;

  @IsString()
  @IsOptional()
  billingAddress?: string;

  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  defaultPaymentTermId?: string;

  @IsNumber()
  @IsOptional()
  defaultDiscountPct?: number;

  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @IsString()
  @IsOptional()
  createdBy?: string;
}
