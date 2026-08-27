import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreerRemboursementDto {
  @ApiProperty({ description: 'ID du rapport de frais validé' })
  @IsNotEmpty()
  @IsUUID()
  ndfRapportFraisId: string;

  @ApiProperty({ description: 'Mode de remboursement (VIREMENT_SEPARE, INTEGRE_BULLETIN_PAIE)' })
  @IsNotEmpty()
  @IsString()
  modeRemboursement: 'VIREMENT_SEPARE' | 'INTEGRE_BULLETIN_PAIE';

  @ApiPropertyOptional({ description: 'Cycle de paie cible si intégration bulletin (YYYY-MM)' })
  @IsOptional()
  @IsString()
  periodePaieCible?: string;
}

export class EnregistrerPaiementDto {
  @ApiProperty({ description: 'Date effective du règlement (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  dateRemboursement: string;

  @ApiPropertyOptional({ description: 'Référence bancaire ou numéro de virement' })
  @IsOptional()
  @IsString()
  referenceBancaire?: string;
}

export class CreateCarteAffaireDto {
  @ApiProperty({ description: 'ID du salarié porteur de la carte' })
  @IsNotEmpty()
  @IsUUID()
  employeRefId: string;

  @ApiProperty({ description: '4 derniers chiffres de la carte (ex: 4521)' })
  @IsNotEmpty()
  @IsString()
  numeroMasque: string;

  @ApiPropertyOptional({ description: 'Émetteur ou banque (ex: Ecobank, BOA)' })
  @IsOptional()
  @IsString()
  emetteur?: string;

  @ApiPropertyOptional({ description: 'Plafond mensuel de dépenses' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plafondMensuel?: number;
}

export class ImportTransactionCarteDto {
  @ApiProperty({ description: 'ID de la carte affaire' })
  @IsNotEmpty()
  @IsUUID()
  ndfCarteAffaireId: string;

  @ApiProperty({ description: 'Date de la transaction (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  dateTransaction: string;

  @ApiProperty({ description: 'Montant de la transaction' })
  @IsNotEmpty()
  @IsNumber()
  montant: number;

  @ApiPropertyOptional({ description: 'Devise (ex: XOF)' })
  @IsOptional()
  @IsString()
  deviseCode?: string;

  @ApiPropertyOptional({ description: 'Libellé du commerçant' })
  @IsOptional()
  @IsString()
  libelleCommercant?: string;
}

export class RapprocherTransactionDto {
  @ApiProperty({ description: 'ID de la transaction carte affaire' })
  @IsNotEmpty()
  @IsUUID()
  ndfTransactionCarteAffaireId: string;

  @ApiProperty({ description: 'ID de la dépense saisie' })
  @IsNotEmpty()
  @IsUUID()
  ndfDepenseId: string;
}
