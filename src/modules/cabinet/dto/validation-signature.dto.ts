import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CabinetDecisionValidation,
  CabinetMethodeSignature,
} from '@prisma/client';

export class CreateCabinetCircuitValidationDto {
  @ApiProperty({ example: 'rh_cycle_paie' })
  @IsString()
  @IsNotEmpty()
  typeObjetCible: string;

  @ApiProperty({
    example: [
      { etape: 1, roleCode: 'COLLABORATEUR_SENIOR', libelle: 'Visa technique senior' },
      { etape: 2, roleCode: 'ASSOCIE', libelle: 'Approbation finale associé' },
    ],
  })
  @IsNotEmpty()
  etapes: any;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

export class SubmitCabinetValidationDto {
  @ApiProperty({ description: 'ID du circuit de validation applicable' })
  @IsUUID()
  @IsNotEmpty()
  cabinetCircuitValidationId: string;

  @ApiProperty({ example: 'rh_cycle_paie' })
  @IsString()
  @IsNotEmpty()
  objetType: string;

  @ApiProperty({ example: 'b5f0535e-9a29-450f-9080-1a0678d4baec', description: "Identifiant ou référence de l'objet métier" })
  @IsString({ message: "L'identifiant de l'objet doit être une chaîne de caractères." })
  @IsNotEmpty({ message: "L'identifiant de l'objet est obligatoire." })
  @MaxLength(100, { message: "L'identifiant de l'objet ne peut pas dépasser 100 caractères." })
  objetId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  etapeOrdre: number;

  @ApiProperty({ enum: CabinetDecisionValidation, example: CabinetDecisionValidation.APPROUVE })
  @IsEnum(CabinetDecisionValidation)
  @IsNotEmpty()
  decision: CabinetDecisionValidation;

  @ApiPropertyOptional({ example: 'Vérification effectuée, tout est conforme aux dispositions OHADA.' })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

export class CreateCabinetSignatureDto {
  @ApiProperty({ example: 'tax_liasse_fiscale' })
  @IsString()
  @IsNotEmpty()
  objetType: string;

  @ApiProperty({ example: 'b5f0535e-9a29-450f-9080-1a0678d4baec', description: "Identifiant ou référence de l'objet métier" })
  @IsString({ message: "L'identifiant de l'objet doit être une chaîne de caractères." })
  @IsNotEmpty({ message: "L'identifiant de l'objet est obligatoire." })
  @MaxLength(100, { message: "L'identifiant de l'objet ne peut pas dépasser 100 caractères." })
  objetId: string;

  @ApiPropertyOptional({ description: 'ID du contact client signataire si signature client' })
  @IsUUID()
  @IsOptional()
  signataireClientContactId?: string;

  @ApiPropertyOptional({
    enum: CabinetMethodeSignature,
    default: CabinetMethodeSignature.SIGNATURE_ELECTRONIQUE_SIMPLE,
  })
  @IsEnum(CabinetMethodeSignature)
  @IsOptional()
  methodeSignature?: CabinetMethodeSignature;

  @ApiProperty({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    description: 'Empreinte cryptographique SHA-256 du document signé',
  })
  @IsString()
  @IsNotEmpty()
  empreinteDocument: string;
}
