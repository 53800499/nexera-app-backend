import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ValidationSignatureService } from './validation-signature.service';
import {
  CreateCabinetCircuitValidationDto,
  CreateCabinetSignatureDto,
  SubmitCabinetValidationDto,
} from '../dto/validation-signature.dto';

@ApiTags('cabinet-validations')
@ApiBearerAuth('access-token')
@Controller('cabinet/validations')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class ValidationSignatureController {
  constructor(
    private readonly validationSignatureService: ValidationSignatureService,
  ) {}

  @Get('circuits')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les modèles de circuits de validation' })
  listCircuits(@Request() req: { user: { tenantId: string } }) {
    return this.validationSignatureService.listCircuitsValidation(
      req.user.tenantId,
    );
  }

  @Post('circuits')
  @Permissions('manage:settings', 'cabinet.read')
  @ApiOperation({ summary: 'Créer un modèle de circuit de validation' })
  createCircuit(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetCircuitValidationDto,
  ) {
    return this.validationSignatureService.createCircuitValidation(
      req.user.tenantId,
      dto,
    );
  }

  @Get('objet/:objetType/:objetId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'objetType' })
  @ApiParam({ name: 'objetId', description: "Identifiant ou référence de l'objet métier" })
  @ApiOperation({ summary: 'Obtenir l’historique des visas et validations d’un objet' })
  getValidationsByObjet(
    @Param('objetType') objetType: string,
    @Param('objetId') objetId: string,
  ) {
    return this.validationSignatureService.listValidationsByObjet(
      objetType,
      objetId,
    );
  }

  @Post('decision')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Soumettre une décision de validation (visa/rejet)' })
  submitValidation(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: SubmitCabinetValidationDto,
  ) {
    return this.validationSignatureService.submitValidation(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }

  @Get('signatures/:objetType/:objetId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'objetType' })
  @ApiParam({ name: 'objetId', description: "Identifiant ou référence de l'objet métier" })
  @ApiOperation({ summary: 'Lister les signatures électroniques apposées sur un objet' })
  getSignaturesByObjet(
    @Param('objetType') objetType: string,
    @Param('objetId') objetId: string,
  ) {
    return this.validationSignatureService.listSignaturesByObjet(
      objetType,
      objetId,
    );
  }

  @Post('signatures')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Apposer une signature électronique probante' })
  apposeSignature(
    @Request() req: { user: { tenantId: string } },
    @Ip() ip: string,
    @Body() dto: CreateCabinetSignatureDto,
  ) {
    return this.validationSignatureService.apposeSignature(
      req.user.tenantId,
      ip,
      dto,
    );
  }
}
