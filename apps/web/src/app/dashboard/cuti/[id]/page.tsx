'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, CircleDot, Clock, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useLeaveRequest, useDecideLeave, useWithdrawLeave, type LeaveApproval } from '@/features/leave/api';

export default function LeaveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canApprove = useAuthStore((s) => s.hasPermission('leave:approve'));
  const { data, isLoading } = useLeaveRequest(id);
  const decide = useDecideLeave(id);
  const withdraw = useWithdrawLeave();
  const [comment, setComment] = useState('');

  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-card" />;

  const isPending = data.status === 'PENDING';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detail Pengajuan Cuti"
        action={
          isPending && (
            <Button
              variant="secondary"
              onClick={() =>
                confirm('Tarik pengajuan ini?') &&
                withdraw.mutate(id, { onSuccess: () => router.push('/dashboard/cuti') })
              }
            >
              Tarik Pengajuan
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-card border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">{data.employee.fullName}</div>
                <div className="text-sm text-ink-muted">
                  {data.leaveType.name} · {data.employee.employeeNo}
                </div>
              </div>
              <StatusBadge status={data.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-ink-subtle">Mulai</div>
                <div>{formatDate(data.startDate)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Selesai</div>
                <div>{formatDate(data.endDate)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-ink-subtle">Alasan</div>
                <div>{data.reason}</div>
              </div>
            </div>
          </div>

          {canApprove && isPending && (
            <div className="rounded-card border border-border bg-card p-6 shadow-card">
              <h3 className="text-base font-medium">Keputusan</h3>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Komentar (opsional)"
                className="mt-3"
              />
              <div className="mt-3 flex gap-3">
                <Button
                  variant="danger"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ decision: 'REJECTED', comment })}
                >
                  <X /> Tolak
                </Button>
                <Button
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ decision: 'APPROVED', comment })}
                >
                  <Check /> Setujui
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Approval timeline */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="mb-4 text-base font-medium">Alur Persetujuan</h3>
          <ol className="space-y-4">
            {data.approvals.map((a) => (
              <TimelineStep key={a.id} approval={a} active={isPending && a.step === data.currentStep} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({ approval, active }: { approval: LeaveApproval; active: boolean }) {
  const icon =
    approval.decision === 'APPROVED' ? (
      <Check className="size-4" />
    ) : approval.decision === 'REJECTED' ? (
      <X className="size-4" />
    ) : active ? (
      <Clock className="size-4" />
    ) : (
      <CircleDot className="size-4" />
    );
  const tone =
    approval.decision === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-700'
      : approval.decision === 'REJECTED'
        ? 'bg-red-100 text-red-700'
        : active
          ? 'bg-amber-100 text-amber-700'
          : 'bg-canvas text-ink-subtle';

  return (
    <li className="flex gap-3">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{approval.role}</div>
        <div className="text-xs text-ink-subtle">
          {approval.decision === 'PENDING'
            ? active
              ? 'Menunggu keputusan'
              : 'Belum diproses'
            : `${approval.decision === 'APPROVED' ? 'Disetujui' : 'Ditolak'}${
                approval.approver ? ` oleh ${approval.approver.fullName}` : ''
              }`}
        </div>
        {approval.comment && <div className="mt-0.5 text-xs text-ink-muted">“{approval.comment}”</div>}
      </div>
    </li>
  );
}
