'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface ChatUser { id: string; fullName: string; email: string }
export interface Message {
  id: string; body: string; senderId: string; conversationId: string; createdAt: string;
  sender: { id: string; fullName: string };
}
export interface Conversation {
  id: string; type: string; name?: string | null;
  members: { userId: string; user: { id: string; fullName: string } }[];
  lastMessage?: Message | null;
  unread: number;
}
export interface Announcement { id: string; title: string; body: string; publishedAt: string; author: { fullName: string } }

export function useChatUsers() {
  return useQuery({ queryKey: ['chat', 'users'], queryFn: async () => (await api.get<ChatUser[]>('/chat/users')).data });
}
export function useConversations() {
  return useQuery({ queryKey: ['chat', 'conversations'], queryFn: async () => (await api.get<Conversation[]>('/chat/conversations')).data });
}
export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: async () => (await api.get<Message[]>(`/chat/conversations/${conversationId}/messages`)).data,
    enabled: !!conversationId,
  });
}
export function useAnnouncements() {
  return useQuery({ queryKey: ['chat', 'announcements'], queryFn: async () => (await api.get<Announcement[]>('/chat/announcements')).data });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { type: string; name?: string; memberIds: string[] }) =>
      (await api.post<Conversation>('/chat/conversations', p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat percakapan')),
  });
}
/** Mark a conversation read → clears its unread badge in the conversation list. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => (await api.post(`/chat/conversations/${conversationId}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/chat/announcements', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat', 'announcements'] }); toast.success('Pengumuman dikirim'); },
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
