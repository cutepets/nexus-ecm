'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Send, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useConversations,
  useMessages,
  useChatUsers,
  useCreateConversation,
  useAnnouncements,
  useCreateAnnouncement,
  useMarkConversationRead,
  type Message,
} from '@/features/chat/api';
import { useChatSocket } from '@/features/chat/use-chat-socket';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Chat" description="Komunikasi internal realtime" />
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Percakapan</TabsTrigger>
          <TabsTrigger value="announcements">Pengumuman</TabsTrigger>
        </TabsList>
        <TabsContent value="chat"><ChatView /></TabsContent>
        <TabsContent value="announcements"><Announcements /></TabsContent>
      </Tabs>
    </div>
  );
}

function ChatView() {
  const me = useAuthStore((s) => s.user);
  const { data: conversations, refetch } = useConversations();
  const [activeId, setActiveId] = useState<string>('');
  const { data: serverMessages } = useMessages(activeId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const markRead = useMarkConversationRead();

  const socket = useChatSocket({
    onMessage: (m) => {
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      // If we're viewing this conversation, immediately mark it read.
      if (m.conversationId === activeId && m.senderId !== me?.id) markRead.mutate(activeId);
    },
    onConversationUpdated: () => refetch(),
  });

  useEffect(() => { if (serverMessages) setMessages(serverMessages); }, [serverMessages]);
  useEffect(() => {
    if (!activeId) return;
    socket.joinConversation(activeId);
    markRead.mutate(activeId); // opening a conversation clears its unread badge
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!text.trim() || !activeId) return;
    socket.sendMessage(activeId, text.trim());
    setText('');
  };

  const title = (c: { name?: string | null; members: { user: { id: string; fullName: string } }[] }) =>
    c.name ?? (c.members.filter((m) => m.user.id !== me?.id).map((m) => m.user.fullName).join(', ') || 'Saya');

  return (
    <div className="grid h-[70vh] grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-1 overflow-y-auto rounded-card border border-border bg-card p-2 shadow-card">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm font-medium">Percakapan</span>
          <NewConversationDialog onCreated={(id) => { refetch(); setActiveId(id); }} />
        </div>
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', activeId === c.id ? 'bg-canvas' : 'hover:bg-canvas')}
          >
            <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(title(c))}</AvatarFallback></Avatar>
            <span className="flex-1 truncate">
              <span className="block font-medium">{title(c)}</span>
              <span className="block truncate text-xs text-ink-subtle">{c.lastMessage?.body ?? 'Belum ada pesan'}</span>
            </span>
            {c.unread > 0 && <span className="rounded-full bg-accent-purple px-1.5 text-[10px] text-white">{c.unread}</span>}
          </button>
        ))}
        {!conversations?.length && <p className="px-3 py-6 text-center text-sm text-ink-subtle">Belum ada percakapan</p>}
      </div>

      <div className="flex flex-col rounded-card border border-border bg-card shadow-card lg:col-span-2">
        {activeId ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.senderId === me?.id ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[70%] rounded-2xl px-3 py-2 text-sm', m.senderId === me?.id ? 'bg-accent-purple/20 text-ink' : 'bg-canvas')}>
                    {m.senderId !== me?.id && <div className="text-xs font-medium text-ink-muted">{m.sender.fullName}</div>}
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-border p-3">
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ketik pesan…" />
              <Button onClick={send}><Send /></Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Pilih percakapan" description="Atau mulai yang baru." />
          </div>
        )}
      </div>
    </div>
  );
}

function NewConversationDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: users } = useChatUsers();
  const create = useCreateConversation();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userId = String(fd.get('userId'));
    if (!userId) return;
    create.mutate({ type: 'DIRECT', memberIds: [userId] }, { onSuccess: (c) => { onCreated(c.id); setOpen(false); } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost"><Plus /></Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Percakapan Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div><Label>Kirim ke</Label>
            <Select name="userId" required>
              <option value="">— Pilih pengguna —</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Mulai</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Announcements() {
  const { data: list } = useAnnouncements();
  const create = useCreateAnnouncement();
  const canPost = useAuthStore((s) => s.hasPermission('chat:create'));
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canPost && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Megaphone /> Pengumuman</Button></DialogTrigger>
            <DialogContent className="p-6">
              <DialogTitle className="text-lg font-medium">Pengumuman Baru</DialogTitle>
              <form
                onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ title: String(fd.get('title')), body: String(fd.get('body')) }, { onSuccess: () => setOpen(false) }); }}
                className="mt-4 space-y-4"
              >
                <div><Label>Judul</Label><Input name="title" required /></div>
                <div><Label>Isi</Label><Input name="body" required /></div>
                <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Kirim</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {list?.length ? (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="rounded-card border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{a.title}</h3>
                <span className="text-xs text-ink-subtle">{formatDate(a.publishedAt)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{a.body}</p>
              <p className="mt-2 text-xs text-ink-subtle">— {a.author.fullName}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="Belum ada pengumuman" />
      )}
    </div>
  );
}
