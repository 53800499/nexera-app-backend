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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('manage:users')
  async create(
    @Body() dto: CreateUserDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.create(dto, req.user.tenantId);
  }

  @Get()
  async findAll(@Request() req: { user: { tenantId: string } }) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:users')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:users')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.remove(id, req.user.tenantId);
  }

  @Patch(':id/status')
  @Permissions('manage:users')
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.toggleStatus(id, req.user.tenantId, isActive);
  }

  @Post(':id/roles')
  @Permissions('manage:users')
  async assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.assignRoles(id, req.user.tenantId, dto);
  }

  @Delete(':id/roles/:roleId')
  @Permissions('manage:users')
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.removeRole(id, roleId, req.user.tenantId);
  }

  @Get(':id/permissions')
  async permissions(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.permissions(id, req.user.tenantId);
  }
}
