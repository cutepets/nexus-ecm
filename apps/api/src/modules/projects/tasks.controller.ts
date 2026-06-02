import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  AddAttachmentDto,
  ChecklistItemDto,
  CommentDto,
  CreateTaskDto,
  MoveTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermissions('task:read')
  @ApiOperation({ summary: 'List tasks (filter by project/assignee/status/priority)' })
  list(@Query() query: TaskQueryDto) {
    return this.tasks.list(query);
  }

  @Get(':id')
  @RequirePermissions('task:read')
  @ApiOperation({ summary: 'Task detail with checklist, comments, attachments' })
  getOne(@Param('id') id: string) {
    return this.tasks.getById(id);
  }

  @Post()
  @RequirePermissions('task:create')
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasks.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('task:update')
  @ApiOperation({ summary: 'Update a task' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasks.update(id, dto, { actorId: user.id });
  }

  @Patch(':id/move')
  @RequirePermissions('task:update')
  @ApiOperation({ summary: 'Move a task between Kanban columns' })
  move(@Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasks.move(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('task:delete')
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.tasks.remove(id, { actorId: user.id });
  }

  // ---- Checklist ----

  @Post(':id/checklist')
  @RequirePermissions('task:update')
  addChecklist(@Param('id') id: string, @Body() dto: ChecklistItemDto) {
    return this.tasks.addChecklistItem(id, dto);
  }

  @Patch('checklist/:itemId/toggle')
  @RequirePermissions('task:update')
  toggleChecklist(@Param('itemId') itemId: string) {
    return this.tasks.toggleChecklistItem(itemId);
  }

  @Delete('checklist/:itemId')
  @RequirePermissions('task:update')
  removeChecklist(@Param('itemId') itemId: string) {
    return this.tasks.removeChecklistItem(itemId);
  }

  // ---- Comments ----

  @Post(':id/comments')
  @RequirePermissions('task:update')
  addComment(@Param('id') id: string, @Body() dto: CommentDto, @CurrentUser() user: RequestUser) {
    return this.tasks.addComment(id, dto, user.id);
  }

  @Delete('comments/:commentId')
  @RequirePermissions('task:update')
  removeComment(@Param('commentId') commentId: string) {
    return this.tasks.removeComment(commentId);
  }

  // ---- Attachments ----

  @Post(':id/uploads')
  @RequirePermissions('task:update')
  presign(@Param('id') id: string, @Body('fileName') fileName: string) {
    return this.tasks.presignAttachment(id, fileName);
  }

  @Post(':id/attachments')
  @RequirePermissions('task:update')
  addAttachment(@Param('id') id: string, @Body() dto: AddAttachmentDto) {
    return this.tasks.addAttachment(id, dto);
  }

  @Delete('attachments/:attachmentId')
  @RequirePermissions('task:update')
  removeAttachment(@Param('attachmentId') attachmentId: string) {
    return this.tasks.removeAttachment(attachmentId);
  }
}
