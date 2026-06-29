import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
  IsArray,
  IsIn,
} from 'class-validator';
import { CABINET_INVITE_CODE_PATTERN } from '../utils/cabinet-invite.util';
import {
  ALL_CABINET_SCOPE_PERMISSION_CODES,
  type CabinetScopePermissionCode,
} from '../constants/cabinet-scope.constants';

export class CabinetAccessDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Identifiant interne du cabinet (usage API / révocation). Préférez inviteCode côté UI.',
  })
  @ValidateIf((dto: CabinetAccessDto) => !dto.inviteCode)
  @IsUUID('4', { message: 'Identifiant de cabinet invalide.' })
  cabinetTenantId?: string;

  @ApiPropertyOptional({
    description:
      "Code d'invitation opaque fourni par le cabinet (recommandé).",
    example: 'NEXR-A7K9-M3P2',
  })
  @ValidateIf((dto: CabinetAccessDto) => !dto.cabinetTenantId)
  @IsString({ message: "Le code d'invitation est invalide." })
  @Matches(CABINET_INVITE_CODE_PATTERN, {
    message: "Format attendu : NEXR-XXXX-XXXX (lettres majuscules et chiffres).",
  })
  inviteCode?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      "Droits accordés au cabinet (défaut : consultation des factures).",
    example: ['cabinet.scope.invoices.read'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(ALL_CABINET_SCOPE_PERMISSION_CODES, { each: true })
  permissions?: CabinetScopePermissionCode[];
}
