'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  useTask,
  useDeleteTask,
  useAddChecklist,
  useToggleChecklist,
  useAddComment,
} from '@/features/tasks/api';
import { PRIORITY_LABEL, PRIORITY_TONE } from '@/features/tasks/constants';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: task, isLoading } = useTask(id);
  const del = useDeleteTask();
  const addCheck = useAddChecklist(id);
  const toggleCheck = useToggleChecklist(id);
  const addComment = useAddComment(id);
  const [comment, setComment] = useState('');

  if (isLoading || !task) return <Skeleton className="h-96 w-full rounded-card" />;

  const doneCount = task.checklist.filter((c) => c.done).length;

  const onAddCheck = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = String(fd.get('label') || '').trim();
    if (label) addCheck.mutate(label, { onSuccess: () => (e.target as HTMLFormElement).reset() });
  };

  const onComment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const assignee = task.assignees[0]?.employeeId;
    if (!comment.trim()) return;
    addComment.mutate(
      { body: comment, authorId: assignee },
      { onSuccess: () => setComment('') },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={task.project?.name}
        action={
          <Button
            variant="danger"
            onClick={() => confirm('Hapus tugas ini?') && del.mutate(id, { onSuccess: () => router.push('/dashboard/tugas') })}
          >
            <Trash2 /> Hapus
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {task.description && (
            <div className="rounded-card border border-border bg-card p-6 shadow-card">
              <h3 className="mb-2 text-sm font-medium text-ink-subtle">Deskripsi</h3>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          {/* Checklist */}
          <div className="rounded-card border border-border bg-card p-6 shadow-card">
            <h3 className="mb-3 text-base font-medium">
              Checklist <span className="text-sm text-ink-subtle">({doneCount}/{task.checklist.length})</span>
            </h3>
            <ul className="space-y-2">
              {task.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <button onClick={() => toggleCheck.mutate(c.id)} className="text-ink-muted hover:text-ink">
                    {c.done ? <CheckSquare className="size-4 text-emerald-600" /> : <Square className="size-4" />}
                  </button>
                  <span className={c.done ? 'text-sm line-through text-ink-subtle' : 'text-sm'}>{c.label}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={onAddCheck} className="mt-3 flex gap-2">
              <Input name="label" placeholder="Tambah item…" />
              <Button type="submit" variant="secondary" disabled={addCheck.isPending}>
                Tambah
              </Button>
            </form>
          </div>

          {/* Comments */}
          <div className="rounded-card border border-border bg-card p-6 shadow-card">
            <h3 className="mb-3 text-base font-medium">Komentar</h3>
            <ul className="space-y-3">
              {task.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initials(c.author.fullName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{c.author.fullName}</span>{' '}
                      <span className="text-xs text-ink-subtle">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-ink-muted">{c.body}</p>
                  </div>
                </li>
              ))}
              {!task.comments.length && <p className="text-sm text-ink-subtle">Belum ada komentar.</p>}
            </ul>
            <form onSubmit={onComment} className="mt-3 flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tulis komentar…" />
              <Button type="submit" disabled={addComment.isPending}>Kirim</Button>
            </form>
          </div>
        </div>

        {/* Meta */}
        <div className="space-y-3 rounded-card border border-border bg-card p-6 shadow-card">
          <Meta label="Status"><StatusBadge status={task.status} /></Meta>
          <Meta label="Prioritas"><Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge></Meta>
          <Meta label="Tenggat">{task.dueDate ? formatDate(task.dueDate) : '—'}</Meta>
          <Meta label="Penanggung Jawab">
            <div className="flex flex-wrap gap-1.5">
              {task.assignees.length
                ? task.assignees.map((a) => (
                    <span key={a.employeeId} className="rounded-full bg-canvas px-2 py-0.5 text-xs">
                      {a.employee.fullName}
                    </span>
                  ))
                : '—'}
            </div>
          </Meta>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-subtle">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
