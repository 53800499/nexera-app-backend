/* eslint-disable prettier/prettier */
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
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RemindersService } from './reminders.service';
import { PaymentBehaviorAnalysisService } from './services/payment-behavior-analysis.service';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';
import { SendManualReminderDto } from './dto/send-manual-reminder.dto';
import { parsePagination } from '../../shared/utils/pagination.util';
import {
  PaymentBehaviorSuggestionDto,
  ReminderListResponseDto,
  ReminderProcessResultDto,
  ReminderResponseDto,
  ReminderSettingsResponseDto,
} from './dto/reminder-response.dto';

@ApiTags('reminders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Permission manage:reminders requise' })
@Controller('reminders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly behaviorAnalysis: PaymentBehaviorAnalysisService,
  ) {}

  @Get('settings')
  @Permissions('reminders.read')
  @ApiOperation({
    summary: 'Paramètres de relance',
    description: 'Délais et options configurables par l\'administrateur.',
  })
  @ApiOkResponse({ type: ReminderSettingsResponseDto })
  getSettings(@Request() req: { user: { tenantId: string } }) {
    return this.remindersService.getSettings(req.user.tenantId);
  }

  @Patch('settings')
  @Permissions('manage:reminders')
  @ApiOperation({
    summary: 'Modifier les paramètres de relance',
    description: 'Niveaux J+3 / J+15 / J+30 entièrement paramétrables.',
  })
  @ApiBody({ type: UpdateReminderSettingsDto })
  @ApiOkResponse({ type: ReminderSettingsResponseDto })
  updateSettings(
    @Body() dto: UpdateReminderSettingsDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.remindersService.updateSettings(req.user.tenantId, dto);
  }

  @Post('process')
  @Permissions('manage:reminders')
  @ApiOperation({
    summary: 'Déclencher les relances automatiques',
    description: 'Exécution manuelle du job quotidien (debug / rattrapage).',
  })
  @ApiOkResponse({ type: ReminderProcessResultDto })
  processAutomatic(@Request() req: { user: { tenantId: string } }) {
    return this.remindersService.processAutomaticReminders(req.user.tenantId);
  }

  @Get()
  @Permissions('reminders.read')
  @ApiOperation({ summary: 'Lister les relances' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiOkResponse({ type: ReminderListResponseDto })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('clientId') clientId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.remindersService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      clientId,
      invoiceId,
    );
  }

  @Get('invoices/:invoiceId')
  @Permissions('reminders.read')
  @ApiOperation({ summary: 'Historique des relances d\'une facture' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiOkResponse({ type: [ReminderResponseDto] })
  findByInvoice(
    @Param('invoiceId') invoiceId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.remindersService.findByInvoice(invoiceId, req.user.tenantId);
  }

  @Get('clients/:clientId')
  @Permissions('reminders.read')
  @ApiOperation({ summary: 'Historique des relances d\'un client' })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiOkResponse({ type: [ReminderResponseDto] })
  findByClient(
    @Param('clientId') clientId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.remindersService.findByClient(clientId, req.user.tenantId);
  }

  @Get('clients/:clientId/payment-behavior')
  @Permissions('reminders.read')
  @ApiOperation({
    summary: 'Analyse comportement de paiement',
    description:
      'Suggestion IA des délais de relance selon l\'historique de paiement du client.',
  })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiOkResponse({ type: PaymentBehaviorSuggestionDto })
  analyzePaymentBehavior(
    @Param('clientId') clientId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.behaviorAnalysis.analyze(clientId, req.user.tenantId);
  }

  @Post('invoices/:invoiceId/send')
  @Permissions('manage:reminders')
  @ApiOperation({
    summary: 'Relance manuelle',
    description:
      '**UC-07** — Déclenchement à tout moment avec message personnalisé.',
  })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiBody({ type: SendManualReminderDto })
  @ApiCreatedResponse({ type: ReminderResponseDto })
  sendManual(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SendManualReminderDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.remindersService.sendManual(
      invoiceId,
      req.user.tenantId,
      dto,
      req.user.sub,
    );
  }
}
