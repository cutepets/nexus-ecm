import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationService } from '../../core/notification/notification.service';
import { CreateAnnouncementDto, CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
  ) {}

  /** Active users (for picking conversation members). */
  listUsers(excludeUserId: string) {
    return this.prisma.user.findMany({
      where: { isActive: true, id: { not: excludeUserId } },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /** Conversations the user belongs to, with last message + unread count. */
  async listConversations(userId: string) {
    const convos = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, fullName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      convos.map(async (c) => {
        const me = c.members.find((m) => m.userId === userId);
        const unread = await this.prisma.message.count({
          where: { conversationId: c.id, createdAt: me?.lastReadAt ? { gt: me.lastReadAt } : undefined, senderId: { not: userId } },
        });
        return { ...c, lastMessage: c.messages[0] ?? null, unread };
      }),
    );
  }

  async createConversation(dto: CreateConversationDto, creatorId: string) {
    if (dto.type === 'GROUP' && !dto.name) throw new BadRequestException('Group conversations need a name');
    const memberIds = Array.from(new Set([creatorId, ...dto.memberIds]));

    // Reuse an existing 1:1 DM if present.
    if (dto.type === 'DIRECT' && memberIds.length === 2) {
      const existing = await this.prisma.conversation.findFirst({
        where: { type: 'DIRECT', AND: memberIds.map((id) => ({ members: { some: { userId: id } } })) },
        include: { members: true },
      });
      if (existing && existing.members.length === 2) return existing;
    }

    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        name: dto.name,
        createdById: creatorId,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: { id: true, fullName: true } } } } },
    });
  }

  async assertMember(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');
  }

  async messages(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, fullName: true } },
        mentions: true,
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    await this.assertMember(conversationId, userId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body: dto.body,
        mentions: dto.mentionIds?.length ? { create: dto.mentionIds.map((uid) => ({ userId: uid })) } : undefined,
      },
      include: { sender: { select: { id: true, fullName: true } }, mentions: true, attachments: true },
    });

    // Notify mentioned users.
    for (const uid of dto.mentionIds ?? []) {
      if (uid !== userId) {
        await this.notify.notifyUser(uid, {
          type: 'MENTION',
          title: `${message.sender.fullName} menyebut Anda`,
          body: dto.body.slice(0, 120),
          data: { conversationId, messageId: message.id },
        });
      }
    }
    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }

  /** Members' userIds for a conversation (used for socket fan-out). */
  async memberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ---- Announcements ----
  listAnnouncements() {
    return this.prisma.announcement.findMany({
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }

  async createAnnouncement(dto: CreateAnnouncementDto, authorId: string) {
    const announcement = await this.prisma.announcement.create({
      data: {
        authorId,
        title: dto.title,
        body: dto.body,
        audience: (dto.audience as Prisma.AnnouncementCreateInput['audience']) ?? 'ALL',
        targetRef: dto.targetRef,
      },
    });
    // Broadcast to all active users (simple ALL audience fan-out).
    if ((dto.audience ?? 'ALL') === 'ALL') {
      const users = await this.prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      await Promise.all(
        users.map((u) =>
          this.notify.notifyUser(u.id, { type: 'ANNOUNCEMENT', title: dto.title, body: dto.body, data: { announcementId: announcement.id } }),
        ),
      );
    }
    return announcement;
  }
}
