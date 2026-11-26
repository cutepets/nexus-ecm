'use client';

import { useParams } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, ListTodo, Users, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useProject, useToggleMilestone } from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import { TaskBoard } from '@/features/tasks/task-board';
import { TaskCreateDialog } from '@/features/tasks/task-create-dialog';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id);
  const { data: tasks } = useTasks({ projectId: id });
  const toggleMs = useToggleMilestone(id);

  if (isLoading || !project) return <Skeleton className="h-96 w-full rounded-card" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.description ?? 'Chưa có mô tả'}`}
        action={<StatusBadge status={project.status} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Tiến độ" value={`${project.progress}%`} icon={TrendingUp} accent="purple" />
        <KpiCard label="Công việc" value={project._count.tasks} icon={ListTodo} accent="cyan" />
        <KpiCard label="Thành viên" value={project.members.length} icon={Users} accent="mint" />
        <KpiCard label="Ngân sách" value={formatCurrency(Number(project.budgetPlanned))} icon={Wallet} accent="pink" />
      </div>

      <Tabs defaultValue="board">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="board">Bảng công việc</TabsTrigger>
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
          </TabsList>
          <TaskCreateDialog projectId={id} />
        </div>

        <TabsContent value="board">
          {tasks?.length ? (
            <TaskBoard tasks={tasks} />
          ) : (
            <EmptyState title="Chưa có công việc" description="Thêm công việc cho dự án này." />
          )}
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 text-base font-medium">Thành viên</h3>
              {project.members.length ? (
                <ul className="space-y-3">
                  {project.members.map((m) => (
                    <li key={m.employeeId} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(m.employee.fullName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{m.employee.fullName}</div>
                        <div className="text-xs text-ink-subtle">{m.role ?? 'Thành viên'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">Chưa có thành viên.</p>
              )}
            </div>

            <div className="rounded-card border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 text-base font-medium">Mốc công việc</h3>
              {project.milestones.length ? (
                <ul className="space-y-2">
                  {project.milestones.map((ms) => (
                    <li key={ms.id} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleMs.mutate({ id: ms.id, title: ms.title, completed: !ms.completed })}
                        className="text-ink-muted hover:text-ink"
                      >
                        {ms.completed ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                      <span className={ms.completed ? 'text-sm line-through text-ink-subtle' : 'text-sm'}>
                        {ms.title}
                      </span>
                      {ms.dueDate && (
                        <span className="ml-auto text-xs text-ink-subtle">{formatDate(ms.dueDate)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">Chưa có mốc công việc.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
