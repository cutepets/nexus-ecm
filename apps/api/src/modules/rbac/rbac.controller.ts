import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { AssignRoleDto, CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/rbac.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('rbac')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermissions('rbac:read')
  @ApiOperation({ summary: 'List roles with their permissions' })
  listRoles() {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('rbac:read')
  @ApiOperation({ summary: 'List all available permissions' })
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Post('roles')
  @RequirePermissions('rbac:create')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbac.createRole(dto.name, dto.description);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('rbac:update')
  @ApiOperation({ summary: 'Replace the permission set of a role, including system roles' })
  setPermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.rbac.setRolePermissions(id, dto.permissionKeys);
  }

  @Patch('roles/:id')
  @RequirePermissions('rbac:update')
  @ApiOperation({ summary: 'Update a role description or custom role name' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbac.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('rbac:delete')
  @ApiOperation({ summary: 'Delete an unused custom role' })
  deleteRole(@Param('id') id: string) {
    return this.rbac.deleteRole(id);
  }

  @Post('users/:userId/roles')
  @RequirePermissions('rbac:update')
  @ApiOperation({ summary: 'Assign a role to a user' })
  assignRole(@Param('userId') userId: string, @Body() dto: AssignRoleDto) {
    return this.rbac.assignRoleToUser(userId, dto.roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('rbac:update')
  @ApiOperation({ summary: 'Remove a role from a user' })
  removeRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.rbac.removeRoleFromUser(userId, roleId);
  }
}
