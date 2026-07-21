import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SettingsService } from './settings.service';
import {
  CreatePaymentTermDto,
  CreateTaxRateDto,
  CreateTenantCurrencyDto,
  EmailTemplateType,
  NumberingDocumentType,
  UpdateEmailTemplateDto,
  UpdateNumberingRuleDto,
  UpdatePaymentTermDto,
  UpdatePdfTemplateDto,
  UpdateTaxRateDto,
  UpdateTenantCurrencyDto,
  UpdateTenantSettingsDto,
} from './dto/settings.dto';
import { UpdateReminderSettingsDto } from '../reminders/dto/update-reminder-settings.dto';
import { ReminderSettingsResponseDto } from '../reminders/dto/reminder-response.dto';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Vue d\'ensemble du paramétrage tenant' })
  getOverview(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.getOverview(req.user.tenantId);
  }

  @Get('tenant')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Paramètres généraux (devise, pénalités, change)' })
  getTenantSettings(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.getTenantSettings(req.user.tenantId);
  }

  @Patch('tenant')
  @Permissions('manage:settings')
  @ApiBody({ type: UpdateTenantSettingsDto })
  updateTenantSettings(
    @Body() dto: UpdateTenantSettingsDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateTenantSettings(req.user.tenantId, dto);
  }

  @Get('tax-rates')
  @Permissions(
    'settings.read',
    'quotations.read',
    'orders.read',
    'invoices.read',
    'catalogue.read',
  )
  listTaxRates(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.listTaxRates(req.user.tenantId);
  }

  @Post('tax-rates')
  @Permissions('manage:settings')
  @ApiBody({ type: CreateTaxRateDto })
  createTaxRate(
    @Body() dto: CreateTaxRateDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.createTaxRate(req.user.tenantId, dto);
  }

  @Patch('tax-rates/:id')
  @Permissions('manage:settings')
  updateTaxRate(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateTaxRate(req.user.tenantId, id, dto);
  }

  @Delete('tax-rates/:id')
  @Permissions('manage:settings')
  deleteTaxRate(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.deleteTaxRate(req.user.tenantId, id);
  }

  @Get('payment-terms')
  @Permissions(
    'settings.read',
    'quotations.read',
    'orders.read',
    'invoices.read',
  )
  listPaymentTerms(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.listPaymentTerms(req.user.tenantId);
  }

  @Post('payment-terms')
  @Permissions('manage:settings')
  @ApiBody({ type: CreatePaymentTermDto })
  createPaymentTerm(
    @Body() dto: CreatePaymentTermDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.createPaymentTerm(req.user.tenantId, dto);
  }

  @Patch('payment-terms/:id')
  @Permissions('manage:settings')
  updatePaymentTerm(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentTermDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updatePaymentTerm(req.user.tenantId, id, dto);
  }

  @Delete('payment-terms/:id')
  @Permissions('manage:settings')
  deletePaymentTerm(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.deletePaymentTerm(req.user.tenantId, id);
  }

  @Get('currencies')
  @Permissions('settings.read')
  listCurrencies(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.listCurrencies(req.user.tenantId);
  }

  @Post('currencies')
  @Permissions('manage:settings')
  @ApiBody({ type: CreateTenantCurrencyDto })
  createCurrency(
    @Body() dto: CreateTenantCurrencyDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.createCurrency(req.user.tenantId, dto);
  }

  @Patch('currencies/:id')
  @Permissions('manage:settings')
  updateCurrency(
    @Param('id') id: string,
    @Body() dto: UpdateTenantCurrencyDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateCurrency(req.user.tenantId, id, dto);
  }

  @Delete('currencies/:id')
  @Permissions('manage:settings')
  deleteCurrency(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.deleteCurrency(req.user.tenantId, id);
  }

  @Get('numbering')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Règles de numérotation des documents' })
  listNumbering(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.listNumberingRules(req.user.tenantId);
  }

  @Patch('numbering/:documentType')
  @Permissions('manage:settings')
  @ApiParam({ name: 'documentType', enum: NumberingDocumentType })
  updateNumbering(
    @Param('documentType') documentType: NumberingDocumentType,
    @Body() dto: UpdateNumberingRuleDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateNumberingRule(
      req.user.tenantId,
      documentType,
      dto,
    );
  }

  @Get('email-templates')
  @Permissions('settings.read')
  listEmailTemplates(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.listEmailTemplates(req.user.tenantId);
  }

  @Get('email-templates/:type')
  @Permissions('settings.read')
  @ApiParam({ name: 'type', enum: EmailTemplateType })
  getEmailTemplate(
    @Param('type') type: EmailTemplateType,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.getEmailTemplate(req.user.tenantId, type);
  }

  @Patch('email-templates/:type')
  @Permissions('manage:settings')
  updateEmailTemplate(
    @Param('type') type: EmailTemplateType,
    @Body() dto: UpdateEmailTemplateDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateEmailTemplate(
      req.user.tenantId,
      type,
      dto,
    );
  }

  @Get('pdf-template')
  @Permissions('settings.read')
  getPdfTemplate(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.getPdfTemplate(req.user.tenantId);
  }

  @Patch('pdf-template')
  @Permissions('manage:settings')
  @ApiBody({ type: UpdatePdfTemplateDto })
  updatePdfTemplate(
    @Body() dto: UpdatePdfTemplateDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updatePdfTemplate(req.user.tenantId, dto);
  }

  @Get('reminders')
  @Permissions('settings.read')
  @ApiOkResponse({ type: ReminderSettingsResponseDto })
  getReminderSettings(@Request() req: { user: { tenantId: string } }) {
    return this.settingsService.getReminderSettings(req.user.tenantId);
  }

  @Patch('reminders')
  @Permissions('manage:settings')
  updateReminderSettings(
    @Body() dto: UpdateReminderSettingsDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.settingsService.updateReminderSettings(req.user.tenantId, dto);
  }
}
