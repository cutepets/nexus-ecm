'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import type { Message } from './api';

/** Socket base = API origin without the /api/v1 path; namespace is /chat. */
function socketUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';
  return base.replace(/\/api\/v1\/?$/, '');
}

interface Handlers {
  onMessage?: (m: Message) => void;
  onTyping?: (p: { conversationId: string; userId: string }) => void;
  onConversationUpdated?: () => void;
}

/** Connect to the chat gateway and subscribe to realtime events. */
export function useChatSocket(handlers: Handlers) {
  const token = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;
    const socket = io(`${socketUrl()}/chat`, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('message:new', (m: Message) => handlersRef.current.onMessage?.(m));
    socket.on('typing', (p) => handlersRef.current.onTyping?.(p));
    socket.on('conversation:updated', () => handlersRef.current.onConversationUpdated?.());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return {
    joinConversation: (conversationId: string) => socketRef.current?.emit('conversation:join', { conversationId }),
    sendMessage: (conversationId: string, body: string) => socketRef.current?.emit('message:send', { conversationId, body }),
    sendTyping: (conversationId: string) => socketRef.current?.emit('typing', { conversationId }),
    markRead: (conversationId: string) => socketRef.current?.emit('message:read', { conversationId }),
  };
}
