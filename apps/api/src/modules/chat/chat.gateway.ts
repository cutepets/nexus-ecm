import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

interface AuthedSocket extends Socket {
  userId?: string;
}

/**
 * Realtime chat over Socket.IO. JWT-authenticated on handshake. Each user joins
 * a personal room (`user:<id>`); conversation rooms fan out messages, typing,
 * read receipts, and presence.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly online = new Map<string, number>(); // userId -> socket count

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token = client.handshake.auth?.token ?? client.handshake.headers.authorization?.replace('Bearer ', '');
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
      client.userId = payload.sub;
      client.join(`user:${payload.sub}`);

      this.online.set(payload.sub, (this.online.get(payload.sub) ?? 0) + 1);
      this.server.emit('presence:update', { userId: payload.sub, online: true });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (!client.userId) return;
    const count = (this.online.get(client.userId) ?? 1) - 1;
    if (count <= 0) {
      this.online.delete(client.userId);
      this.server.emit('presence:update', { userId: client.userId, online: false });
    } else {
      this.online.set(client.userId, count);
    }
  }

  @SubscribeMessage('conversation:join')
  onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId: string }) {
    client.join(`conversation:${body.conversationId}`);
    return { joined: body.conversationId };
  }

  @SubscribeMessage('message:send')
  async onMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string } & SendMessageDto,
  ) {
    if (!client.userId) return;
    const message = await this.chat.sendMessage(body.conversationId, client.userId, {
      body: body.body,
      mentionIds: body.mentionIds,
    });
    this.server.to(`conversation:${body.conversationId}`).emit('message:new', message);
    // Nudge members not in the room (so their conversation list updates).
    const members = await this.chat.memberIds(body.conversationId);
    members.forEach((uid) => this.server.to(`user:${uid}`).emit('conversation:updated', { conversationId: body.conversationId }));
    return message;
  }

  @SubscribeMessage('typing')
  onTyping(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId: string }) {
    client.to(`conversation:${body.conversationId}`).emit('typing', { conversationId: body.conversationId, userId: client.userId });
  }

  @SubscribeMessage('message:read')
  async onRead(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId: string }) {
    if (!client.userId) return;
    await this.chat.markRead(body.conversationId, client.userId);
    client.to(`conversation:${body.conversationId}`).emit('read', { conversationId: body.conversationId, userId: client.userId });
  }
}
