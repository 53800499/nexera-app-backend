import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEtablissementDto {
  @ApiProperty({ example: 'BJ', description: 'Code ISO2 du pays' })
  @IsString()
  @IsNotEmpty()
  paysCode: string;

  @ApiProperty({ example: 'SIEGE-COT', description: 'Code unique de l’établissement' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'NEXERA SERVICES BENIN SARL' })
  @IsString()
  @IsNotEmpty()
  raisonSociale: string;

  @ApiPropertyOptional({ example: '0202612345678' })
  @IsString()
  @IsOptional()
  identifiantFiscal?: string;

  @ApiPropertyOptional({ example: '0202612345678' })
  @IsString()
  @IsOptional()
  ifu?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  numeroEmployeurSecuSociale?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  numeroCnss?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  conventionCollectiveId?: string;

  @ApiPropertyOptional({ example: 'Haie Vive, Cotonou' })
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional({ example: 'Cotonou' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ example: '+229 21 00 00 00' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ example: 'contact@nexera.bj' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  estSiege?: boolean;
}

export class UpdateEtablissementDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  raisonSociale?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  identifiantFiscal?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ifu?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroEmployeurSecuSociale?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroCnss?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  conventionCollectiveId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estSiege?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

export class CreateDepartementDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  etablissementId: string;

  @ApiProperty({ example: 'DIR-FIN' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Direction Financière & Comptable' })
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departementParentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentDepartementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsableId?: string;
}

export class UpdateDepartementDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departementParentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentDepartementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsableId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

export class CreatePosteDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  departementId: string;

  @ApiProperty({ example: 'CPT-SR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Comptable Senior' })
  @IsString()
  @IsNotEmpty()
  intitule: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categorieProfessionnelleId?: string;

  @ApiPropertyOptional({ example: 'BAC+4/5 en Comptabilité' })
  @IsString()
  @IsOptional()
  niveauCompetenceRequis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  salaireMinConseille?: number;

  @ApiPropertyOptional()
  @IsOptional()
  salaireMaxConseille?: number;
}

export class UpdatePosteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  intitule?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categorieProfessionnelleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  niveauCompetenceRequis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  salaireMinConseille?: number;

  @ApiPropertyOptional()
  @IsOptional()
  salaireMaxConseille?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}
