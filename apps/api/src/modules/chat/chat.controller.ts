import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateAnnouncementDto, CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('users')
  @RequirePermissions('chat:read')
  @ApiOperation({ summary: 'Active users to start a conversation with' })
  users(@CurrentUser() user: RequestUser) {
    return this.chat.listUsers(user.id);
  }

  @Get('conversations')
  @RequirePermissions('chat:read')
  @ApiOperation({ summary: 'My conversations with last message + unread count' })
  conversations(@CurrentUser() user: RequestUser) {
    return this.chat.listConversations(user.id);
  }

  @Post('conversations')
  @RequirePermissions('chat:create')
  createConversation(@Body() dto: CreateConversationDto, @CurrentUser() user: RequestUser) {
    return this.chat.createConversation(dto, user.id);
  }

  @Get('conversations/:id/messages')
  @RequirePermissions('chat:read')
  messages(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.chat.messages(id, user.id);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('chat:create')
  @ApiOperation({ summary: 'Send a message via REST (also broadcast over Socket.IO when sent there)' })
  send(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentUser() user: RequestUser) {
    return this.chat.sendMessage(id, user.id, dto);
  }

  @Post('conversations/:id/read')
  @RequirePermissions('chat:read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.chat.markRead(id, user.id);
  }

  // ---- Announcements ----
  @Get('announcements')
  @RequirePermissions('chat:read')
  announcements() {
    return this.chat.listAnnouncements();
  }

  @Post('announcements')
  @RequirePermissions('chat:create')
  createAnnouncement(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: RequestUser) {
    return this.chat.createAnnouncement(dto, user.id);
  }
}
