'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatDate } from '@/lib/utils';
import { useTasks, type TaskListItem } from '@/features/tasks/api';
import { TaskBoard } from '@/features/tasks/task-board';
import { TaskCreateDialog } from '@/features/tasks/task-create-dialog';
import { PRIORITY_LABEL, PRIORITY_TONE } from '@/features/tasks/constants';

export default function TugasPage() {
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();

  const columns = useMemo<ColumnDef<TaskListItem>[]>(
    () => [
      { accessorKey: 'title', header: 'Công việc', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
      { id: 'project', header: 'Dự án', cell: ({ row }) => row.original.project?.code ?? '—' },
      {
        accessorKey: 'priority',
        header: 'Prioritas',
        cell: ({ row }) => <Badge tone={PRIORITY_TONE[row.original.priority]}>{PRIORITY_LABEL[row.original.priority]}</Badge>,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'due', header: 'Tenggat', cell: ({ row }) => (row.original.dueDate ? formatDate(row.original.dueDate) : '—') },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Công việc" description="Quản lý công việc trên tất cả dự án" action={<TaskCreateDialog />} />

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="table">Tabel</TabsTrigger>
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <TaskBoard tasks={tasks ?? []} />
        </TabsContent>

        <TabsContent value="table">
          <DataTable
            columns={columns}
            data={tasks ?? []}
            loading={isLoading}
            searchPlaceholder="Tìm công việc…"
            emptyTitle="Chưa có công việc"
            onRowClick={(t) => router.push(`/dashboard/tugas/${t.id}`)}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarView tasks={tasks ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CalendarView({ tasks }: { tasks: TaskListItem[] }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date());

  const { cells, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const byDay = new Map<string, TaskListItem[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = String(d.getDate());
        byDay.set(key, [...(byDay.get(key) ?? []), t]);
      }
    }

    const cells: { day: number | null; tasks: TaskListItem[] }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null, tasks: [] });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, tasks: byDay.get(String(d)) ?? [] });

    return {
      cells,
      monthLabel: cursor.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    };
  }, [cursor, tasks]);

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium capitalize">{monthLabel}</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-subtle">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              'min-h-24 rounded-lg border border-border p-1.5 text-left',
              cell.day ? 'bg-card' : 'bg-canvas/40',
            )}
          >
            {cell.day && <div className="mb-1 text-xs text-ink-subtle">{cell.day}</div>}
            <div className="space-y-1">
              {cell.tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/dashboard/tugas/${t.id}`)}
                  className="block w-full truncate rounded bg-accent-purple/15 px-1.5 py-0.5 text-left text-[11px] text-purple-700 hover:bg-accent-purple/25"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
