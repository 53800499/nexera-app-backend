import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  @Permissions('manage:roles')
  async create(@Body() dto: CreateRoleDto, @Request() req: any) {
    return this.rolesService.create(dto);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.rolesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.rolesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:roles')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: any,
  ) {
    return this.rolesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:roles')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.rolesService.remove(id, req.user.tenantId);
  }

  @Post(':roleId/permissions/:permissionId')
  @Permissions('manage:roles')
  async addPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: any,
  ) {
    return this.rolesService.addPermission(
      roleId,
      permissionId,
      req.user.tenantId,
    );
  }

  @Delete(':roleId/permissions/:permissionId')
  @Permissions('manage:roles')
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: any,
  ) {
    return this.rolesService.removePermission(
      roleId,
      permissionId,
      req.user.tenantId,
    );
  }
}
