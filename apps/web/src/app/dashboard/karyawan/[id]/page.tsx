'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Upload, FileText, ExternalLink, BriefcaseBusiness, ShieldCheck, Clock3, KeyRound, ScanFace } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useEmployee,
  useDeleteEmployee,
  useDeletionEligibility,
  useUploadDocument,
  useDeleteDocument,
  useResetEmployeePassword,
} from '@/features/employees/api';
import { useFaceStatus, usePurgeFace } from '@/features/attendance/api';
import { EmploymentUpdateDialog } from '@/features/employees/employment-update-dialog';

const DOC_TYPES = ['KTP', 'NPWP', 'CV', 'CONTRACT', 'OTHER'];

function historyTypeLabel(type: string) {
  return ({ INITIAL_HIRE: 'Bắt đầu làm việc', COMPENSATION: 'Điều chỉnh lương, thưởng', POSITION: 'Thay đổi chức vụ', BRANCH: 'Điều chuyển chi nhánh', SCHEDULE: 'Thay đổi ca làm nền', WORK_STATUS: 'Thay đổi trạng thái làm việc', EMPLOYMENT_TERMS: 'Thay đổi điều kiện làm việc' } as Record<string, string>)[type] ?? 'Thay đổi thông tin nhân sự';
}

function historyFieldLabel(field: string) {
  return ({ basicSalary: 'Lương cơ bản', spaBonusPercent: 'Thưởng Spa', employmentType: 'Loại hình', jobTitle: 'Chức danh', positionId: 'Chức vụ', departmentId: 'Phòng ban', primaryBranchId: 'Chi nhánh chính', branchIds: 'Các chi nhánh', workScheduleIds: 'Ca làm nền', workStatus: 'Trạng thái làm việc' } as Record<string, string>)[field] ?? field;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useEmployee(id);
  const resetPassword = useResetEmployeePassword(id, data?.user?.id ?? '');
  const { data: faceStatus } = useFaceStatus(id);
  const purgeFace = usePurgeFace(id);
  const { data: eligibility } = useDeletionEligibility(id);
  const del = useDeleteEmployee();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canUpdate = hasPermission('employee:update');
  const canResetPassword = hasPermission('user:reset-password');
  const canManageFace = hasPermission('attendance:face:enroll');
  const canReadPayroll = hasPermission('payroll:read');
  const [employmentUpdateOpen, setEmploymentUpdateOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetActorPassword, setResetActorPassword] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [deleteFaceOpen, setDeleteFaceOpen] = useState(false);
  const canPermanentlyDelete = user?.roles.includes('ADMIN') && hasPermission('employee:delete');

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-card" />;
  }

  if (isError || !data) {
    return (
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h1 className="text-xl font-semibold">Không tải được hồ sơ nhân viên</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Máy chủ không trả được dữ liệu chi tiết. Kiểm tra kết nối API và migration cơ sở dữ liệu rồi thử lại.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => router.push('/dashboard/karyawan')}>Quay lại danh sách</Button>
          <Button onClick={() => void refetch()}>Thử lại</Button>
        </div>
      </section>
    );
  }

  const onPermanentDelete = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    del.mutate(
      { id, currentPassword },
      { onSuccess: () => router.push('/dashboard/karyawan') },
    );
  };

  const employmentHistory = data.employmentHistory ?? [];
  const historyTimeline = [
    ...employmentHistory.map((entry) => ({ id: entry.id, date: entry.effectiveDate, kind: 'change' as const, entry })),
    ...(data.jobHistory ?? [])
      .filter((job) => !employmentHistory.some((change) => change.effectiveDate.slice(0, 10) === job.startDate.slice(0, 10) && change.changes.some((item) => ['positionId', 'departmentId', 'jobTitle'].includes(item.field))))
      .map((entry) => ({ id: entry.id, date: entry.startDate, kind: 'job' as const, entry })),
    ...(canReadPayroll ? (data.salaryHistory ?? [])
      .filter((salary) => !employmentHistory.some((change) => change.effectiveDate.slice(0, 10) === salary.effectiveDate.slice(0, 10) && change.changes.some((item) => item.field === 'basicSalary')))
      .map((entry) => ({ id: entry.id, date: entry.effectiveDate, kind: 'salary' as const, entry })) : []),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân viên"
        description={`Hồ sơ ${data.fullName}`}
        action={
          <div className="flex gap-2">
            {canUpdate && <Button asChild variant="secondary">
              <Link href={`/dashboard/karyawan/${id}/edit`}>
                <Pencil />
              </Link>
            </Button>}
            {canResetPassword && data.user && <Button variant="secondary" aria-label="Đặt lại mật khẩu" title="Đặt lại mật khẩu" onClick={() => setResetPasswordOpen(true)}><KeyRound /></Button>}
            {canManageFace && faceStatus?.enrolled && <Button variant="danger" aria-label="Xóa khuôn mặt chấm công" title="Xóa khuôn mặt chấm công" onClick={() => setDeleteFaceOpen(true)}><ScanFace /></Button>}
            {canUpdate && <Button onClick={() => setEmploymentUpdateOpen(true)}><Clock3 /></Button>}
            {canPermanentlyDelete && (
              <Button variant="danger" onClick={() => setPermanentDeleteOpen(true)} disabled={del.isPending}><Trash2 /></Button>
            )}
          </div>
        }
      />

      <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-5 p-6 sm:p-8">
        <Avatar className="size-24 rounded-3xl border border-border shadow-card">
          {data.photoUrl && <AvatarImage src={data.photoUrl} alt={data.fullName} />}
          <AvatarFallback className="text-lg">{initials(data.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{data.fullName}</h2>
            <StatusBadge status={data.workStatus} />
          </div>
          <p className="text-sm text-ink-muted">
            @{data.user?.username ?? data.employeeNo} · {data.phone ?? 'Chưa có SĐT'} · {data.position?.title ?? 'Chưa có chức danh'} ·{' '}
            {data.department?.name ?? 'Chưa có phòng ban'}
          </p>
        </div>
        <div className="grid min-w-[240px] grid-cols-2 gap-3">
          <SummaryMetric label="Chi nhánh" value={String(data.branchAssignments?.length ?? 0)} />
          <SummaryMetric label="Tài liệu" value={String(data.documents.length)} />
        </div>
        </div>
        <div className="border-t border-border px-6 sm:px-8"><Tabs defaultValue="info"><TabsList className="h-auto bg-transparent p-0"><TabsTrigger value="info" className="rounded-none border-b-2 border-transparent px-4 py-4 data-[state=active]:border-purple-700 data-[state=active]:bg-transparent">Tổng quan</TabsTrigger><TabsTrigger value="jobs" className="rounded-none border-b-2 border-transparent px-4 py-4 data-[state=active]:border-purple-700 data-[state=active]:bg-transparent">Quá trình làm việc</TabsTrigger>{canReadPayroll && <TabsTrigger value="salary" className="rounded-none border-b-2 border-transparent px-4 py-4 data-[state=active]:border-purple-700 data-[state=active]:bg-transparent">Lương</TabsTrigger>}<TabsTrigger value="docs" className="rounded-none border-b-2 border-transparent px-4 py-4 data-[state=active]:border-purple-700 data-[state=active]:bg-transparent">Tài liệu</TabsTrigger><TabsTrigger value="account" className="rounded-none border-b-2 border-transparent px-4 py-4 data-[state=active]:border-purple-700 data-[state=active]:bg-transparent">Tài khoản & quyền</TabsTrigger></TabsList>

        <TabsContent value="info" className="pb-6 pt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfileCard icon={<ContactIcon />} title="Thông tin cơ bản"><ProfileField label="Email" value={data.email} /><ProfileField label="Điện thoại" value={data.phone} /><ProfileField label="Ngày sinh" value={data.dateOfBirth ? formatDate(data.dateOfBirth) : null} /><ProfileField label="Giới tính" value={data.gender === 'MALE' ? 'Nam' : data.gender === 'FEMALE' ? 'Nữ' : data.gender === 'OTHER' ? 'Khác' : data.gender === 'UNDISCLOSED' ? 'Không muốn nêu' : null} /><ProfileField label="CCCD / CMND" value={data.identityCode} /><ProfileField label="Liên hệ khẩn cấp" value={[data.emergencyContactName, data.emergencyContactPhone].filter(Boolean).join(' · ')} /><ProfileField label="Quản lý trực tiếp" value={data.manager?.fullName} /><ProfileField label="Địa chỉ" value={data.address} /></ProfileCard>
            <ProfileCard icon={<BriefcaseBusiness className="size-5" />} title="Hợp đồng & ca làm"><ProfileField label="Ngày vào làm" value={formatDate(data.joinDate)} /><ProfileField label="Thâm niên" value={tenure(data.joinDate, data.exitDate)} /><ProfileField label="Phòng ban / chức danh" value={[data.department?.name, data.position?.title ?? data.jobTitle ?? 'Nhân viên'].filter(Boolean).join(' · ')} /><ProfileField label="Ca làm" value={data.workScheduleAssignments?.map(({ workSchedule }) => `${workSchedule.name} (${workSchedule.startTime}–${workSchedule.endTime})`).join(', ')} /><ProfileField label="Chi nhánh" value={data.primaryBranch?.name ?? data.branchAssignments?.map(({ branch }) => branch.name).join(', ')} /><ProfileField label="Ngày nghỉ việc" value={data.exitDate ? formatDate(data.exitDate) : null} />{canReadPayroll && <><ProfileField label="Mã số thuế" value={data.taxCode} /><ProfileField label="Ngân hàng / STK" value={[data.salaryBankName, data.salaryBankAccount].filter(Boolean).join(' · ')} /></>}</ProfileCard>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="pb-6 pt-6">
          <h3 className="mb-3 font-semibold">Các mốc thay đổi dài hạn</h3>
          {historyTimeline.length ? (
            <div className="mb-6 space-y-3">
              {historyTimeline.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-card border border-border bg-card p-4">
                {item.kind === 'change' ? <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-medium">{historyTypeLabel(item.entry.changeType)}</p><p className="mt-1 text-sm text-ink-muted">Hiệu lực {formatDate(item.date)}{item.entry.decisionNumber ? ` · Quyết định ${item.entry.decisionNumber}` : ''}</p></div>
                    {item.entry.reason && <p className="max-w-xl text-sm text-ink-muted">{item.entry.reason}</p>}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">{item.entry.changes.map((change, index) => <li key={`${item.id}-${index}`}><span className="font-medium">{historyFieldLabel(change.field)}:</span> {String(change.before ?? '—')} → {String(change.after ?? '—')}</li>)}</ul>
                  {item.entry.documents.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.entry.documents.map((document) => <a key={document.id} href={document.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-canvas px-3 py-1.5 text-sm text-purple-700 hover:underline"><FileText size={15} />{document.fileName}<ExternalLink size={13} /></a>)}</div>}
                </> : item.kind === 'job' ? <><p className="font-medium">Thay đổi chức vụ</p><p className="mt-1 text-sm">{item.entry.position?.title ?? '—'}{item.entry.department ? ` · ${item.entry.department.name}` : ''}</p><p className="mt-1 text-sm text-ink-muted">Hiệu lực {formatDate(item.date)}{item.entry.endDate ? ` · Kết thúc ${formatDate(item.entry.endDate)}` : ''}</p>{item.entry.note && <p className="mt-1 text-sm text-ink-muted">{item.entry.note}</p>}</> : <><p className="font-medium">Điều chỉnh lương</p><p className="mt-1 text-sm">{formatCurrency(Number(item.entry.amount))} {item.entry.currency}</p><p className="mt-1 text-sm text-ink-muted">Hiệu lực {formatDate(item.date)}{item.entry.reason ? ` · ${item.entry.reason}` : ''}</p></>}
              </article>)}
            </div>
          ) : <p className="mb-6 text-sm text-ink-muted">Chưa có mốc thay đổi dài hạn.</p>}
        </TabsContent>

        {canReadPayroll && <TabsContent value="salary" className="pb-6 pt-6">
          <SalaryTab entries={data.salaryHistory} />
        </TabsContent>}

        <TabsContent value="docs" className="pb-6 pt-6">
          <DocsTab employeeId={id} documents={data.documents} />
        </TabsContent>

        <TabsContent value="account" className="pb-6 pt-6">
          {data.user ? (
            <div className="rounded-card border border-border bg-card p-5 shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Tên đăng nhập" value={data.user.username} />
                <InfoRow label="Email đăng nhập" value={data.user.email} />
                <InfoRow label="Số điện thoại đăng nhập" value={data.user.phone} />
                <InfoRow label="Lần đăng nhập gần nhất" value={data.user.lastLoginAt ? formatDate(data.user.lastLoginAt) : 'Chưa từng'} />
              </div>
              <div className="mt-4"><p className="text-xs text-ink-subtle">Vai trò</p><div className="mt-2 flex flex-wrap gap-2">{data.user.roles.map(({ role }) => <StatusBadge key={role.id} status={role.name} />)}</div></div>
            </div>
          ) : (
            <EmptyState title="Tài khoản cần được đối soát" description="Hồ sơ demo cũ chưa có account. Pha chuyển đổi sẽ ghép account trước khi bật ràng buộc 1–1 ở database." />
          )}
        </TabsContent>
        </Tabs></div>
      </section>

      <Dialog open={deleteFaceOpen} onOpenChange={setDeleteFaceOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Xóa khuôn mặt chấm công</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-muted">Xóa mẫu khuôn mặt của {data.fullName}. Nhân viên sẽ được mời đăng ký khuôn mặt mới ở lần mở trang chấm công tiếp theo.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="secondary">Hủy</Button></DialogClose><Button variant="danger" disabled={purgeFace.isPending} onClick={() => purgeFace.mutate(undefined, { onSuccess: () => setDeleteFaceOpen(false) })}>{purgeFace.isPending ? 'Đang xóa…' : 'Xóa khuôn mặt'}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Đặt lại mật khẩu nhân viên</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-muted">Mật khẩu mới là mật khẩu tạm. Nhân viên sẽ được yêu cầu đổi sau khi đăng nhập.</DialogDescription>
          <form className="mt-5 space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (!data.user) return;
            resetPassword.mutate({ password: temporaryPassword, currentPassword: resetActorPassword }, {
              onSuccess: () => { setResetPasswordOpen(false); setResetActorPassword(''); setTemporaryPassword(''); },
            });
          }}>
            <div><Label>Mật khẩu admin hiện tại</Label><Input type="password" autoComplete="current-password" value={resetActorPassword} onChange={(event) => setResetActorPassword(event.target.value)} required /></div>
            <div><Label>Mật khẩu tạm mới</Label><Input type="password" autoComplete="new-password" minLength={8} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></div>
            <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="secondary">Hủy</Button></DialogClose><Button type="submit" disabled={resetPassword.isPending}>{resetPassword.isPending ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={permanentDeleteOpen} onOpenChange={setPermanentDeleteOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Xóa vĩnh viễn nhân viên</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-muted">
            Xóa tài khoản, lịch sử chấm công, lương, ca làm, hồ sơ và dữ liệu nhân sự của {data.fullName}. Hành động này không thể hoàn tác.
          </DialogDescription>
          <form className="mt-5 space-y-4" onSubmit={onPermanentDelete}>
            <div>
              <Label>Mật khẩu hiện tại của admin</Label>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
            </div>
            {eligibility && !eligibility.canDelete && (
              <p className="rounded-lg bg-accent-pink/15 px-3 py-2 text-sm text-pink-700">
                Sẽ xóa {eligibility.total} bản ghi lịch sử liên quan.
              </p>
            )}
            <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="secondary">Hủy</Button></DialogClose><Button type="submit" variant="danger" disabled={del.isPending}>Xóa</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <EmploymentUpdateDialog employeeId={id} currentStatus={data.workStatus} onOpen={employmentUpdateOpen} onClose={() => setEmploymentUpdateOpen(false)} onSaved={() => {}} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-ink-subtle">{label}</div>
      <div className="mt-0.5 text-sm">{value || '—'}</div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-canvas px-4 py-3"><p className="text-xs text-ink-subtle">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function ContactIcon() { return <ShieldCheck className="size-5" />; }
function ProfileCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-card border border-border p-5"><h3 className="flex items-center gap-2 text-lg font-semibold [&_svg]:text-purple-700">{icon}{title}</h3><div className="mt-4 divide-y divide-border">{children}</div></section>; }
function ProfileField({ label, value }: { label: string; value?: string | null }) { return <div className="flex gap-5 py-3 text-sm"><span className="w-40 shrink-0 text-ink-muted">{label}</span><span className="min-w-0 font-medium">{value || '—'}</span></div>; }
function tenure(joinDate: string, exitDate?: string | null) {
  const toCalendarDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
  };
  const start = toCalendarDate(joinDate);
  const end = toCalendarDate(exitDate ?? new Date().toISOString());
  if (!start || !end) return "—";

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  if (months < 0) return "—";
  if (months === 0) return "Dưới 1 tháng";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return [
    years ? `${years} năm` : null,
    remainingMonths ? `${remainingMonths} tháng` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function SalaryTab({
  entries,
}: {
  entries: { id: string; amount: string; currency: string; effectiveDate: string; reason?: string | null }[];
}) {
  return (
    <div>
      {entries.length ? (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          {entries.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
              <div>
                <div className="text-sm font-medium">{formatCurrency(Number(s.amount))}</div>
                {s.reason && <div className="text-xs text-ink-subtle">{s.reason}</div>}
              </div>
              <div className="text-xs text-ink-muted">{formatDate(s.effectiveDate)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Chưa có lịch sử lương" />
      )}
    </div>
  );
}

function DocsTab({
  employeeId,
  documents,
}: {
  employeeId: string;
  documents: { id: string; docType: string; fileUrl: string; fileName: string; status: string }[];
}) {
  const upload = useUploadDocument(employeeId);
  const del = useDeleteDocument(employeeId);
  const [docType, setDocType] = useState('KTP');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, docType }, { onSuccess: () => (e.target.value = '') });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4 shadow-card">
        <div className="w-40">
          <Label>Loại tài liệu</Label>
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'CONTRACT' ? 'Hợp đồng' : t === 'OTHER' ? 'Khác' : t}
              </option>
            ))}
          </Select>
        </div>
        <Button asChild variant="secondary" disabled={upload.isPending}>
          <label className="cursor-pointer">
            <Upload /> {upload.isPending ? 'Đang tải lên…' : 'Tải tệp lên'}
            <input type="file" className="hidden" onChange={onFile} disabled={upload.isPending} />
          </label>
        </Button>
      </div>

      {documents.length ? (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-ink-subtle" />
                <div>
                  <div className="text-sm font-medium">{d.fileName}</div>
                  <div className="text-xs text-ink-subtle">
                    <StatusBadge status={d.docType} /> <StatusBadge status={d.status} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label="Mở tệp">
                    <ExternalLink />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(d.id)} aria-label="Xóa tài liệu">
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Chưa có tài liệu" description="Tải lên CCCD, mã số thuế, CV hoặc hợp đồng." />
      )}
    </div>
  );
}
