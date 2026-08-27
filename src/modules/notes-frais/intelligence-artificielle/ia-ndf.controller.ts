import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { IaNdfService } from './ia-ndf.service';
import { ScanJustificatifDto, TraiterAnomalieDto } from '../dto/ia-scan.dto';

@ApiTags('notes-frais-ia')
@ApiBearerAuth('access-token')
@Controller('notes-frais/ia')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IaNdfController {
  constructor(private readonly iaService: IaNdfService) {}

  @Post('scan-justificatif')
  @Permissions('ndf.expenses.submit')
  @ApiOperation({
    summary: 'Scanner et extraire les champs d’un justificatif (OCR assisté par IA)',
  })
  async scannerJustificatif(@Body() dto: ScanJustificatifDto) {
    return this.iaService.scannerJustificatif(dto);
  }

  @Post('auditer-rapport/:id')
  @Permissions('ndf.reports.validate')
  @ApiOperation({
    summary: 'Lancer l’analyse IA et le moteur d’anomalies sur un rapport de frais',
  })
  @ApiParam({ name: 'id', description: 'ID du rapport de frais' })
  async auditerRapport(@Request() req: any, @Param('id') id: string) {
    return this.iaService.auditerRapportFrais(req.user.tenantId, id);
  }

  @Get('anomalies')
  @Permissions('ndf.reports.validate')
  @ApiOperation({ summary: 'Lister les anomalies détectées par le moteur IA' })
  @ApiQuery({ name: 'rapportId', required: false })
  async getAnomalies(
    @Request() req: any,
    @Query('rapportId') rapportId?: string,
  ) {
    return this.iaService.getAnomalies(req.user.tenantId, rapportId);
  }

  @Patch('anomalies/:id/traiter')
  @Permissions('ndf.reports.validate')
  @ApiOperation({
    summary: 'Traiter une anomalie (Confirmer ou Écarter comme faux positif)',
  })
  @ApiParam({ name: 'id', description: 'ID de l’anomalie' })
  async traiterAnomalie(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: TraiterAnomalieDto,
  ) {
    const userId = req.user.sub || req.user.id || req.user.userId || 'system';
    return this.iaService.traiterAnomalie(
      req.user.tenantId,
      id,
      userId,
      dto,
    );
  }
}
