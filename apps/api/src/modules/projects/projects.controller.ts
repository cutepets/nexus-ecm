import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { AddMemberDto, CreateProjectDto, UpdateProjectDto, UpsertMilestoneDto } from './dto/project.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'List projects' })
  list(@Query('status') status?: string) {
    return this.projects.list(status);
  }

  @Get(':id')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Project detail with members & milestones' })
  getOne(@Param('id') id: string) {
    return this.projects.getById(id);
  }

  @Post()
  @RequirePermissions('project:create')
  @ApiOperation({ summary: 'Create a project' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projects.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Update a project' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projects.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('project:delete')
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.remove(id, { actorId: user.id });
  }

  // ---- Members ----

  @Post(':id/members')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Add or update a project member' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.projects.addMember(id, dto);
  }

  @Delete(':id/members/:employeeId')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Remove a project member' })
  removeMember(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.projects.removeMember(id, employeeId);
  }

  // ---- Milestones ----

  @Post(':id/milestones')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Add a milestone' })
  addMilestone(@Param('id') id: string, @Body() dto: UpsertMilestoneDto) {
    return this.projects.addMilestone(id, dto);
  }

  @Put('milestones/:milestoneId')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Update a milestone' })
  updateMilestone(@Param('milestoneId') milestoneId: string, @Body() dto: UpsertMilestoneDto) {
    return this.projects.updateMilestone(milestoneId, dto);
  }

  @Delete('milestones/:milestoneId')
  @RequirePermissions('project:update')
  @ApiOperation({ summary: 'Delete a milestone' })
  removeMilestone(@Param('milestoneId') milestoneId: string) {
    return this.projects.removeMilestone(milestoneId);
  }
}
