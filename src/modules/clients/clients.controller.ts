import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Permissions('manage:clients')
  create(@Body() dto: CreateClientDto, @Request() req: any) {
    return this.clientsService.create(dto, req.user.tenantId);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    return this.clientsService.findAll(
      req.user.tenantId,
      Number(page),
      Number(limit),
      q,
    );
  }

  @Get('search')
  search(@Request() req: any, @Query('q') q = '') {
    return this.clientsService.search(req.user.tenantId, q);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.clientsService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:clients')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Request() req: any,
  ) {
    return this.clientsService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:clients')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.clientsService.remove(id, req.user.tenantId);
  }

  @Post(':id/contacts')
  @Permissions('manage:clients')
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @Request() req: any,
  ) {
    return this.clientsService.createContact(id, req.user.tenantId, dto);
  }

  @Patch('contacts/:id')
  @Permissions('manage:clients')
  updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @Request() req: any,
  ) {
    return this.clientsService.updateContact(id, req.user.tenantId, dto);
  }

  @Delete('contacts/:id')
  @Permissions('manage:clients')
  removeContact(@Param('id') id: string, @Request() req: any) {
    return this.clientsService.removeContact(id, req.user.tenantId);
  }
}
