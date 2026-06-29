import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn } from 'class-validator';
import {
  ALL_CABINET_SCOPE_PERMISSION_CODES,
  type CabinetScopePermissionCode,
} from '../constants/cabinet-scope.constants';

export class UpdateCabinetPermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['cabinet.scope.invoices.read'],
    description: "Droits accordés par l'entreprise au cabinet sur son dossier.",
  })
  @IsArray({ message: 'Les permissions doivent être un tableau.' })
  @ArrayNotEmpty({ message: 'Sélectionnez au moins un droit à accorder.' })
  @IsIn(ALL_CABINET_SCOPE_PERMISSION_CODES, {
    each: true,
    message: 'Permission cabinet invalide.',
  })
  permissions!: CabinetScopePermissionCode[];
}
