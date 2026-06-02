'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, formatDate } from '@/lib/utils';
import { TASK_COLUMNS, PRIORITY_LABEL, PRIORITY_TONE } from './constants';
import { useMoveTask, type TaskListItem, type TaskStatus } from './api';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export function TaskBoard({ tasks }: { tasks: TaskListItem[] }) {
  const move = useMoveTask();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overStatus = e.over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && overStatus && task.status !== overStatus) {
      move.mutate({ id: task.id, status: overStatus });
    }
  };

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            tasks={tasks.filter((t) => t.status === col.status)}
          />
        ))}
      </div>
      <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, label, tasks }: { status: TaskStatus; label: string; tasks: TaskListItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-32 flex-col gap-3 rounded-card border border-border bg-canvas/60 p-3 transition-colors',
        isOver && 'bg-accent-purple/10 ring-2 ring-accent-purple/30',
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-ink-subtle">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <DraggableCard key={t.id} task={t} />
      ))}
    </div>
  );
}

function DraggableCard({ task }: { task: TaskListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, overlay }: { task: TaskListItem; overlay?: boolean }) {
  const router = useRouter();
  return (
    <div
      onClick={() => !overlay && router.push(`/dashboard/tugas/${task.id}`)}
      className={cn(
        'cursor-pointer rounded-xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-card-hover',
        overlay && 'rotate-2 shadow-card-hover',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
      </div>
      {task.project && <div className="mt-1 text-xs text-ink-subtle">{task.project.code}</div>}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((a) => (
            <Avatar key={a.employeeId} className="size-6 ring-2 ring-card">
              <AvatarFallback className="text-[10px]">{initials(a.employee.fullName)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-subtle">
          {task._count.checklist > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="size-3" /> {task._count.checklist}
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" /> {task._count.comments}
            </span>
          )}
          {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
        </div>
      </div>
    </div>
  );
}
