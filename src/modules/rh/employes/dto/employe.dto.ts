import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  RhGender,
  RhMaritalStatus,
  RhIdentityDocType,
  RhEmploymentStatus,
  RhPaymentMethod,
} from '@prisma/client';

export class CreateEmployeDto {
  @ApiPropertyOptional({ example: 'EMP-000001', description: 'Si non renseigné, généré automatiquement' })
  @IsString()
  @IsOptional()
  matricule?: string;

  @ApiPropertyOptional({ example: 'M.' })
  @IsString()
  @IsOptional()
  civilite?: string;

  @ApiProperty({ example: 'MENSAH' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ example: 'Koffi Jean' })
  @IsString()
  @IsNotEmpty()
  prenoms: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomJeuneFille?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsDateString()
  @IsOptional()
  dateNaissance?: string;

  @ApiPropertyOptional({ example: 'Cotonou' })
  @IsString()
  @IsOptional()
  lieuNaissance?: string;

  @ApiPropertyOptional({ example: 'BJ' })
  @IsString()
  @IsOptional()
  nationaliteIso2?: string;

  @ApiPropertyOptional({ enum: RhGender, default: RhGender.M })
  @IsEnum(RhGender)
  @IsOptional()
  sexe?: RhGender;

  @ApiPropertyOptional({ enum: RhMaritalStatus, default: RhMaritalStatus.CELIBATAIRE })
  @IsEnum(RhMaritalStatus)
  @IsOptional()
  situationFamiliale?: RhMaritalStatus;

  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  nombreEnfantsCharge?: number;

  @ApiPropertyOptional({ enum: RhIdentityDocType, default: RhIdentityDocType.CNI })
  @IsEnum(RhIdentityDocType)
  @IsOptional()
  typePieceIdentite?: RhIdentityDocType;

  @ApiPropertyOptional({ example: '1234567890123' })
  @IsString()
  @IsOptional()
  numeroPieceIdentite?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateExpirationPiece?: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsString()
  @IsOptional()
  npi?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsString()
  @IsOptional()
  numeroCnss?: string;

  @ApiPropertyOptional({ example: '3202612345678' })
  @IsString()
  @IsOptional()
  numeroIfu?: string;

  @ApiPropertyOptional({ example: 'koffi.mensah@entreprise.bj' })
  @IsEmail()
  @IsOptional()
  emailProfessionnel?: string;

  @ApiPropertyOptional({ example: 'koffi.mensah@gmail.com' })
  @IsEmail()
  @IsOptional()
  emailPersonnel?: string;

  @ApiPropertyOptional({ example: '+229 97 00 00 00' })
  @IsString()
  @IsOptional()
  telephone1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone2?: string;

  @ApiPropertyOptional({ example: 'Cadjehoun, Rue 123' })
  @IsString()
  @IsOptional()
  adresseResidence?: string;

  @ApiPropertyOptional({ example: 'Cotonou' })
  @IsString()
  @IsOptional()
  villeResidence?: string;

  @ApiPropertyOptional({ enum: RhEmploymentStatus, default: RhEmploymentStatus.ACTIF })
  @IsEnum(RhEmploymentStatus)
  @IsOptional()
  statutEmploi?: RhEmploymentStatus;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateEntreeEntreprise: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  dateAnciennete?: string;

  // Initial Assignment
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  etablissementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posteId?: string;
}

export class UpdateEmployeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  civilite?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prenoms?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomJeuneFille?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateNaissance?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lieuNaissance?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nationaliteIso2?: string;

  @ApiPropertyOptional({ enum: RhGender })
  @IsEnum(RhGender)
  @IsOptional()
  sexe?: RhGender;

  @ApiPropertyOptional({ enum: RhMaritalStatus })
  @IsEnum(RhMaritalStatus)
  @IsOptional()
  situationFamiliale?: RhMaritalStatus;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  nombreEnfantsCharge?: number;

  @ApiPropertyOptional({ enum: RhIdentityDocType })
  @IsEnum(RhIdentityDocType)
  @IsOptional()
  typePieceIdentite?: RhIdentityDocType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroPieceIdentite?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateExpirationPiece?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  npi?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroCnss?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroIfu?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  emailProfessionnel?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  emailPersonnel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adresseResidence?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  villeResidence?: string;

  @ApiPropertyOptional({ enum: RhEmploymentStatus })
  @IsEnum(RhEmploymentStatus)
  @IsOptional()
  statutEmploi?: RhEmploymentStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateEntreeEntreprise?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateAnciennete?: string;

  // Optionnel pour mise à jour de l'affectation actuelle
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  etablissementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posteId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  utilisateurId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateSortieDefinitive?: string;
}

export class CreatePersonneAChargeDto {
  @ApiProperty({ example: 'ENFANT', description: 'CONJOINT, ENFANT, PARENT' })
  @IsString()
  @IsNotEmpty()
  lienParente: string;

  @ApiProperty({ example: 'MENSAH Aya Marie' })
  @IsString()
  @IsNotEmpty()
  nomPrenoms: string;

  @ApiProperty({ example: '2020-04-10' })
  @IsDateString()
  @IsNotEmpty()
  dateNaissance: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  estFiscalementACharge?: boolean;
}

export class CreateCoordonneeBancaireDto {
  @ApiProperty({ enum: RhPaymentMethod, default: RhPaymentMethod.VIREMENT_BANCAIRE })
  @IsEnum(RhPaymentMethod)
  @IsNotEmpty()
  modePaiement: RhPaymentMethod;

  @ApiPropertyOptional({ example: 'BOA Bénin' })
  @IsString()
  @IsOptional()
  banqueNom?: string;

  @ApiPropertyOptional({ example: 'BJ061' })
  @IsString()
  @IsOptional()
  codeBanque?: string;

  @ApiPropertyOptional({ example: '01001' })
  @IsString()
  @IsOptional()
  codeGuichet?: string;

  @ApiPropertyOptional({ example: 'BJ66BJ0610100101234567890123' })
  @IsString()
  @IsOptional()
  numeroCompteIban?: string;

  @ApiPropertyOptional({ example: '45' })
  @IsString()
  @IsOptional()
  cleRib?: string;

  @ApiPropertyOptional({ example: 'MTN Mobile Money' })
  @IsString()
  @IsOptional()
  operateurMobileMoney?: string;

  @ApiPropertyOptional({ example: '+229 97 00 00 00' })
  @IsString()
  @IsOptional()
  numeroMobileMoney?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  estComptePrincipal?: boolean;
}

export class CreateAffectationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  etablissementId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departementId?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  posteId: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @ApiPropertyOptional({ example: 'Promotion interne' })
  @IsString()
  @IsOptional()
  motifAffectation?: string;

  @ApiPropertyOptional({ example: 'Promotion interne' })
  @IsString()
  @IsOptional()
  motif?: string;
}

export class CreateEmployeDocumentDto {
  @ApiProperty({ example: 'CNI', description: 'CNI, DIPLOME, CASIER_JUDICIAIRE, CERTIFICAT_MEDICAL, CONTRAT, VISA' })
  @IsString()
  @IsNotEmpty()
  typeDocument: string;

  @ApiPropertyOptional({ example: 'Carte Nationale d’Identité Biométrique' })
  @IsString()
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional({ example: 'Carte Nationale d’Identité Biométrique' })
  @IsString()
  @IsOptional()
  titre?: string;

  @ApiProperty({ example: 'https://storage.nexera.bj/docs/cni.pdf' })
  @IsString()
  @IsNotEmpty()
  fichierUrl: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomFichier?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateEmission?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateExpiration?: string;
}

export class CreerCompteUtilisateurDto {
  @ApiPropertyOptional({ example: 'eric.mensah@nexera.bj', description: 'Si non renseigné, utilise l’email professionnel du collaborateur' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: ['uuid-du-role-commercial'], description: 'Liste des IDs de rôles ERP à attribuer' })
  @IsArray()
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ example: 'Password123!', description: 'Mot de passe initial (généré aléatoirement si omis)' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ default: true, description: 'Envoyer un email d’invitation au collaborateur' })
  @IsBoolean()
  @IsOptional()
  envoyerInvitation?: boolean;
}

export class LierCompteUtilisateurDto {
  @ApiProperty({ example: 'uuid-de-l-utilisateur-existant', description: 'Identifiant UUID du compte utilisateur à lier' })
  @IsUUID()
  @IsNotEmpty()
  utilisateurId: string;
}
