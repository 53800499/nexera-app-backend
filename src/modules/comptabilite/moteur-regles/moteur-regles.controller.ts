import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { MoteurReglesService } from './moteur-regles.service';

@ApiTags('compta-moteur-regles')
@ApiBearerAuth('access-token')
@Controller('compta/moteur-regles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MoteurReglesController {
  constructor(private readonly moteurReglesService: MoteurReglesService) {}

  @Get('regles')
  @Permissions('compta.plan.read')
  async getRegles(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.moteurReglesService.getRegles(tenantId);
  }

  @Post('regles')
  @Permissions('compta.plan.write')
  async createRegle(
    @Request() req: any,
    @Body() dto: any,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.moteurReglesService.createRegle(tenantId, dto, userId);
  }

  @Put('regles/:id')
  @Permissions('compta.plan.write')
  async updateRegle(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.moteurReglesService.updateRegle(tenantId, id, dto, userId);
  }

  @Delete('regles/:id')
  @Permissions('compta.plan.write')
  async deleteRegle(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.moteurReglesService.deleteRegle(tenantId, id);
  }

  @Get('evenements')
  @Permissions('compta.ecritures.read')
  async getEvenements(
    @Request() req: any,
    @Query('statutTraitement') statutTraitement?: string,
    @Query('moduleSource') moduleSource?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.moteurReglesService.getEvenements(tenantId, {
      statutTraitement,
      moduleSource,
    });
  }

  @Post('evenements/ingerer')
  @Permissions('compta.ecritures.write')
  async ingererEvenement(
    @Request() req: any,
    @Body()
    dto: {
      moduleSource: 'M1' | 'M2' | 'M4' | 'M5' | 'M7';
      typeEvenement: string;
      referenceExterne: string;
      payload: any;
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.moteurReglesService.ingererEvenement(tenantId, dto, userId);
  }

  @Post('evenements/:id/retraiter')
  @Permissions('compta.ecritures.write')
  async retraiterEvenement(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.moteurReglesService.retraiterEvenement(tenantId, id, userId);
  }
}
