'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Landmark, Phone, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { uploadEmployeeIdentityCards, uploadNewEmployeeIdentityCards } from './api';
import { IdCardQrCapture, type IdCardData, type PreparedIdentityFiles } from './id-card-qr-capture';
import { useBranches, useWorkSchedules } from '@/features/settings/api';
import { useDepartments, usePositions } from './api';
import { useAuthStore } from '@/stores/auth-store';
import type { EmployeeDetail } from '@nexus/shared';

const INITIAL_PASSWORD = '123456';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const normalizePhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s().-]/g, '');
  return /^\d{9}$/.test(compact) ? `0${compact}` : value;
};
function submitErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'Không thể lưu thông tin nhân viên.';
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(' ');
  if (typeof message === 'string') return message;
  return 'Không thể lưu thông tin nhân viên.';
}
const WORK_STATUS = [
  { value: 'PROBATION', label: 'Thử việc' }, { value: 'PERMANENT', label: 'Chính thức' },
  { value: 'INACTIVE', label: 'Thôi việc' },
  { value: 'ABANDONED', label: 'Bỏ việc' },
];
const schema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  phone: z.string().optional(), email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  address: z.string().optional(), gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.string().optional(), identityCode: z.string().regex(/^$|^\d{9}$|^\d{12}$/, 'CCCD/CMND gồm 9 hoặc 12 chữ số').optional(),
  emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(),
  taxCode: z.string().regex(/^$|^\d{10}(-\d{3})?$/, 'Mã số thuế gồm 10 số hoặc 10 số-3 số').optional(),
  salaryBankName: z.string().optional(), salaryBankAccount: z.string().optional(),
  basicSalary: z.string().regex(/^$|^\d+(\.\d{1,2})?$/, 'Lương cơ bản không hợp lệ').optional(),
  spaBonusPercent: z.string().regex(/^$|^(100|\d{1,2})(\.\d{1,2})?$/, '% thưởng Spa phải từ 0 đến 100').optional(),
  primaryBranchId: z.string().min(1, 'Vui lòng chọn chi nhánh làm việc chính'), departmentId: z.string().optional(), positionId: z.string().optional(), employmentType: z.enum(['FULL_TIME', 'PART_TIME']), workScheduleId: z.string().optional(), workStatus: z.string(),
  joinDate: z.string().min(1, 'Vui lòng nhập ngày vào làm'), probationDays: z.string().regex(/^\d+$/, 'Số ngày thử việc phải là số nguyên không âm').optional(),
});
const profileSchema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  phone: z.string().optional(), email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  address: z.string().optional(), gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.string().optional(), identityCode: z.string().regex(/^$|^\d{9}$|^\d{12}$/, 'CCCD/CMND gồm 9 hoặc 12 chữ số').optional(),
  emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(),
  taxCode: z.string().regex(/^$|^\d{10}(-\d{3})?$/, 'Mã số thuế gồm 10 số hoặc 10 số-3 số').optional(),
  salaryBankName: z.string().optional(), salaryBankAccount: z.string().optional(),
});

interface Props { defaultValues?: Partial<EmployeeDetail>; employeeId?: string; submitting?: boolean; onSubmit: (values: Record<string, unknown>) => void | Promise<unknown>; onSaved?: () => void; }

export function EmployeeForm({ defaultValues, employeeId, submitting, onSubmit, onSaved }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isCreate = !defaultValues;
  const canManageCompensation = useAuthStore((state) => state.hasPermission('payroll:update'));
  const [fullName, setFullName] = useState(defaultValues?.fullName ?? '');
  const [username, setUsername] = useState(defaultValues?.user?.username ?? '');
  const usernameEdited = useRef(Boolean(defaultValues?.user?.username));
  const [accountEmail, setAccountEmail] = useState(defaultValues?.user?.email ?? defaultValues?.email ?? '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>(defaultValues?.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
  const [employmentType, setEmploymentType] = useState<'FULL_TIME' | 'PART_TIME'>(defaultValues?.employmentType ?? 'FULL_TIME');
  const [workScheduleId, setWorkScheduleId] = useState(defaultValues?.workScheduleAssignments?.[0]?.workSchedule.id ?? '');
  const [departmentId, setDepartmentId] = useState(defaultValues?.department?.id ?? '');
  const [positionId, setPositionId] = useState(defaultValues?.position?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idCardFiles, setIdCardFiles] = useState<PreparedIdentityFiles>({});
  const [identityComparison, setIdentityComparison] = useState<{ field: string; matches: boolean }[]>([]);
  const { data: branches } = useBranches();
  const { data: workSchedules } = useWorkSchedules();
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions(departmentId || undefined);
  const initials = useMemo(() => ((defaultValues?.fullName ?? username) || 'NV').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(), [defaultValues?.fullName, username]);
  useEffect(() => { if (isCreate && !workScheduleId && workSchedules?.[0]) setWorkScheduleId(workSchedules[0].id); }, [isCreate, workScheduleId, workSchedules]);
  useEffect(() => {
    if (!isCreate || departmentId || !departments) return;
    const department = departments.find((item) => item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN') === 'ban hang');
    if (department) setDepartmentId(department.id);
  }, [departmentId, departments, isCreate]);
  useEffect(() => {
    if (!isCreate || positionId || !departmentId || !positions) return;
    const position = positions.find((item) => item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN') === 'nhan vien');
    if (position) setPositionId(position.id);
  }, [departmentId, isCreate, positionId, positions]);
  useEffect(() => {
    if (!isCreate || usernameEdited.current) return;
    const name = fullName.trim();
    if (name.length < 2) { setUsername(''); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void api.get<{ username: string }>('/employees/username-suggestion', { params: { fullName: name } })
        .then(({ data }) => { if (active && !usernameEdited.current) setUsername(data.username); })
        .catch(() => undefined);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [fullName, isCreate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    raw.gender = gender; raw.employmentType = employmentType;
    const parsed = (isCreate ? schema : profileSchema).safeParse(raw);
    const nextErrors: Record<string, string> = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(username.trim().toLowerCase())) nextErrors.username = 'Tên đăng nhập gồm 3–32 ký tự chữ thường, số, ., _ hoặc -';
    if (!z.string().email().safeParse(accountEmail.trim()).success) nextErrors.accountEmail = 'Vui lòng nhập email hợp lệ';
    if (!parsed.success || Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    const payload: Record<string, unknown> = isCreate
      ? Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== ''))
      : Object.fromEntries(Object.entries(parsed.data)
          .filter(([key, value]) =>
            ['fullName', 'phone', 'email', 'address', 'gender', 'dateOfBirth', 'identityCode', 'emergencyContactName', 'emergencyContactPhone', 'taxCode', 'salaryBankName', 'salaryBankAccount'].includes(key) &&
            (value !== '' || key === 'identityCode') &&
            (key !== 'phone' || value !== defaultValues?.phone)
          ));
    payload.username = username.trim().toLowerCase(); payload.email = accountEmail.trim().toLowerCase();
    if (isCreate) {
      payload.workScheduleId = workScheduleId;
      payload.departmentId = departmentId || null;
      payload.positionId = positionId || null;
      payload.password = INITIAL_PASSWORD;
      if (payload.basicSalary !== undefined) payload.basicSalary = Number(payload.basicSalary);
      if (payload.spaBonusPercent !== undefined) payload.spaBonusPercent = Number(payload.spaBonusPercent);
    }
    try {
      if (isCreate && idCardFiles.prepare) {
        const files = await idCardFiles.prepare();
        if (files.front || files.back) Object.assign(payload, await uploadNewEmployeeIdentityCards(files));
      }
      setErrors({}); await onSubmit(payload);
      if (!isCreate && employeeId && idCardFiles.prepare) {
        const files = await idCardFiles.prepare();
        if (files.front || files.back) await uploadEmployeeIdentityCards(employeeId, files);
      }
      onSaved?.();
    } catch (error) {
      setErrors({ form: submitErrorMessage(error) });
    }
  };

  const applyIdCardData = (data: IdCardData) => {
    if (!isCreate) {
      const current = (name: string) => (formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
      const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN');
      const comparisons = [
        ['Họ và tên', data.fullName, current('fullName')],
        ['Số CCCD', data.identityCode, current('identityCode')],
        ['Ngày sinh', data.dateOfBirth, current('dateOfBirth')],
        ['Địa chỉ', data.address, current('address')],
      ].filter((item): item is [string, string, string] => Boolean(item[1]));
      if (data.gender) comparisons.push(['Giới tính', data.gender, gender]);
      setIdentityComparison(comparisons.map(([field, scanned, entered]) => ({ field, matches: normalize(scanned) === normalize(entered) })));
      return;
    }
    const setValue = (name: string, value?: string) => {
      if (!value) return;
      const element = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (element) element.value = value;
    };
    if (data.fullName) setFullName(data.fullName);
    setValue('identityCode', data.identityCode); setValue('dateOfBirth', data.dateOfBirth); setValue('address', data.address);
    if (data.gender) setGender(data.gender);
  };

  return <form ref={formRef} onSubmit={submit} className="mx-auto max-w-7xl space-y-6 pb-24">
    {errors.form && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.form}</p>}
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="grid gap-6 border-t border-border p-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-6">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start"><section className="rounded-card border border-border bg-canvas/40 p-5"><SectionTitle icon={<UserRound />} title="Thông tin nhân viên" /><div className="mx-auto my-5 flex size-28 items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card text-3xl font-semibold text-purple-700">{initials}</div><div className="space-y-4"><Field label="Họ và tên" error={errors.fullName} required><Input name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" /></Field><Field label="Tên đăng nhập" error={errors.username} required><Input value={username} onChange={(event) => { usernameEdited.current = true; setUsername(event.target.value.replace(/\s/g, '').toLowerCase()); }} autoComplete="username" placeholder="pdthanh" />{isCreate && <p className="mt-1 text-xs text-ink-muted">Gợi ý: viết tắt họ và tên đệm, ghép với tên không dấu.</p>}</Field>{isCreate && <Field label="Mật khẩu khởi tạo"><Input value={INITIAL_PASSWORD} readOnly className="bg-canvas text-ink-muted" /></Field>}<Field label="Giới tính"><div className="flex overflow-hidden rounded-xl border border-border"><button type="button" onClick={() => setGender('MALE')} className={`h-10 flex-1 text-sm font-medium ${gender === 'MALE' ? 'bg-ink text-white' : 'bg-card text-ink-muted'}`}>Nam</button><button type="button" onClick={() => setGender('FEMALE')} className={`h-10 flex-1 text-sm font-medium ${gender === 'FEMALE' ? 'bg-ink text-white' : 'bg-card text-ink-muted'}`}>Nữ</button></div></Field><IdCardQrCapture onData={applyIdCardData} onFiles={setIdCardFiles} initialImages={{ front: defaultValues?.documents?.find((document) => document.fileName === 'can-cuoc-mat-truoc')?.fileUrl, back: defaultValues?.documents?.find((document) => document.fileName === 'can-cuoc-mat-sau')?.fileUrl }} />{errors.idCard && <p className="text-sm text-red-600">{errors.idCard}</p>}{identityComparison.length > 0 && <div className="rounded-xl border border-border bg-card p-3"><p className="text-sm font-semibold">Đối chiếu QR với thông tin đang khai báo</p><div className="mt-2 flex flex-wrap gap-2">{identityComparison.map((item) => <span key={item.field} className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.matches ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{item.field}: {item.matches ? 'Khớp' : 'Không khớp'}</span>)}</div></div>}</div></section></aside>
        <div className="space-y-6">
          <section className="rounded-card border border-border p-5"><SectionTitle icon={<Phone />} title="Thông tin liên hệ & cá nhân" /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Số điện thoại"><Input name="phone" defaultValue={defaultValues?.phone ?? ''} onBlur={(event) => { event.currentTarget.value = normalizePhoneInput(event.currentTarget.value); }} placeholder="0901234567" /></Field><Field label="Email" error={errors.email || errors.accountEmail}><Input name="email" type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="nhanvien@gmail.com" /></Field><Field label="CCCD / CMND" error={errors.identityCode}><Input name="identityCode" inputMode="numeric" defaultValue={defaultValues?.identityCode ?? ''} placeholder="001099000000" /><p className="mt-1 text-xs text-ink-muted">Có thể để trống và bổ sung sau.</p></Field><Field label="Ngày sinh"><Input name="dateOfBirth" type="date" defaultValue={defaultValues?.dateOfBirth?.slice(0, 10) ?? ''} /></Field><Field label="Người liên hệ khẩn cấp"><Input name="emergencyContactName" defaultValue={defaultValues?.emergencyContactName ?? ''} placeholder="Họ và tên / quan hệ" /></Field><Field label="SĐT khẩn cấp"><Input name="emergencyContactPhone" defaultValue={defaultValues?.emergencyContactPhone ?? ''} onBlur={(event) => { event.currentTarget.value = normalizePhoneInput(event.currentTarget.value); }} placeholder="0901234567" /></Field><Field label="Địa chỉ" className="sm:col-span-2"><Textarea name="address" defaultValue={defaultValues?.address ?? ''} placeholder="Địa chỉ liên hệ" /></Field></div></section>
          <section className={`${isCreate ? "" : "hidden"} rounded-card border border-border p-5`}><SectionTitle icon={<BriefcaseBusiness />} title="Công việc" /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Chi nhánh làm việc chính" error={errors.primaryBranchId} required><Select name="primaryBranchId" defaultValue={defaultValues?.primaryBranch?.id ?? ''}><option value="">Chọn chi nhánh</option>{branches?.filter((branch) => branch.isActive).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field><Field label="Phòng ban"><Select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPositionId(''); }}><option value="">Bán Hàng (gợi ý)</option>{departments?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></Field><Field label="Chức vụ"><Select value={positionId} onChange={(event) => setPositionId(event.target.value)}><option value="">Nhân Viên (gợi ý)</option>{positions?.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</Select></Field><Field label="Loại hình"><input type="hidden" name="employmentType" value={employmentType} /><div className="flex overflow-hidden rounded-xl border border-border"><button type="button" onClick={() => setEmploymentType('FULL_TIME')} className={`h-10 flex-1 text-sm font-medium ${employmentType === 'FULL_TIME' ? 'bg-ink text-white' : 'bg-card text-ink-muted'}`}>Full Time</button><button type="button" onClick={() => setEmploymentType('PART_TIME')} className={`h-10 flex-1 text-sm font-medium ${employmentType === 'PART_TIME' ? 'bg-ink text-white' : 'bg-card text-ink-muted'}`}>Part Time</button></div></Field><Field label="Ca làm mặc định"><Select name="workScheduleId" value={workScheduleId} onChange={(event) => setWorkScheduleId(event.target.value)}><option value="">Chọn ca làm</option>{workSchedules?.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {schedule.startTime}–{schedule.endTime}</option>)}</Select></Field><Field label="Ngày vào làm" error={errors.joinDate} required><Input name="joinDate" type="date" defaultValue={defaultValues?.joinDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} /></Field><Field label="Số ngày thử việc" error={errors.probationDays}><Input name="probationDays" type="number" min={0} step={1} defaultValue={defaultValues?.probationDays ?? 20} placeholder="20" /></Field><Field label="Trạng thái làm việc"><Select name="workStatus" defaultValue={defaultValues?.workStatus ?? 'PROBATION'}>{WORK_STATUS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</Select></Field></div>

          </section>
          {canManageCompensation && <section className="rounded-card border border-border p-5"><SectionTitle icon={<Landmark />} title="Lương & tài khoản nhận lương" /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field className={!isCreate ? "hidden" : undefined} label="Lương cơ bản" error={errors.basicSalary}><Input name="basicSalary" inputMode="decimal" defaultValue={defaultValues?.basicSalary ?? ''} placeholder="8000000" /></Field><Field className={!isCreate ? "hidden" : undefined} label="% Thưởng Spa" error={errors.spaBonusPercent}><Input name="spaBonusPercent" inputMode="decimal" defaultValue={defaultValues?.spaBonusPercent ?? ''} placeholder="10" /></Field><Field label="Mã số thuế" error={errors.taxCode}><Input name="taxCode" defaultValue={defaultValues?.taxCode ?? ''} placeholder="0123456789" /></Field><Field label="Ngân hàng"><Input name="salaryBankName" defaultValue={defaultValues?.salaryBankName ?? ''} placeholder="Vietcombank" /></Field><Field label="Số tài khoản"><Input name="salaryBankAccount" inputMode="numeric" defaultValue={defaultValues?.salaryBankAccount ?? ''} placeholder="0123456789" /></Field></div></section>}
        </div>
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-4 backdrop-blur"><div className="mx-auto flex max-w-7xl justify-end gap-3"><Button type="button" variant="secondary" onClick={() => router.back()}>Hủy</Button><Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : isCreate ? 'Tạo nhân viên' : 'Lưu'}</Button></div></div>
  </form>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h3 className="flex items-center gap-2 text-base font-semibold text-ink [&_svg]:size-5 [&_svg]:text-purple-700">{icon}{title}</h3>; }
function Field({ label, error, required, className, children }: { label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) { return <div className={className}><Label>{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>{children}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>; }
