'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDepartments, usePositions } from './api';
import type { EmployeeDetail } from '@nexus/shared';

/** Email domain auto-appended to the username when provisioning a login account. */
const EMAIL_DOMAIN = 'nexus.local';

const WORK_STATUS: { value: string; label: string }[] = [
  { value: 'PROBATION', label: 'Probation' },
  { value: 'PERMANENT', label: 'Tetap' },
  { value: 'CONTRACT', label: 'Kontrak' },
  { value: 'INACTIVE', label: 'Nonaktif' },
];

const schema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().optional(),
  address: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  workStatus: z.string(),
  joinDate: z.string().min(1, 'Tanggal bergabung wajib diisi'),
});

interface Props {
  defaultValues?: Partial<EmployeeDetail>;
  submitting?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}

export function EmployeeForm({ defaultValues, submitting, onSubmit }: Props) {
  const router = useRouter();
  const isCreate = !defaultValues;
  const [departmentId, setDepartmentId] = useState(defaultValues?.department?.id ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: departments } = useDepartments();
  const { data: positions } = usePositions(departmentId || undefined);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== ''),
    );

    if (isCreate) {
      // Account is optional; if either field is filled, both are required.
      if (username || password) {
        const fieldErrors: Record<string, string> = {};
        if (!username) fieldErrors.username = 'Username wajib untuk membuat akun';
        if (!password || password.length < 6) fieldErrors.password = 'Password minimal 6 karakter';
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors);
          return;
        }
        payload.email = `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
        payload.password = password;
      }
    } else {
      const email = String(raw.email ?? '').trim();
      if (email) payload.email = email;
    }

    setErrors({});
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="text-base font-medium">Informasi Dasar</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama Lengkap" error={errors.fullName} required>
            <Input name="fullName" defaultValue={defaultValues?.fullName} placeholder="Budi Santoso" />
          </Field>
          {!isCreate && (
            <Field label="Email">
              <Input name="email" type="email" defaultValue={defaultValues?.email ?? ''} placeholder="budi@nexus.local" />
            </Field>
          )}
          <Field label="Telepon">
            <Input name="phone" defaultValue={defaultValues?.phone ?? ''} placeholder="08xx" />
          </Field>
          <Field label="Tanggal Bergabung" error={errors.joinDate} required>
            <Input name="joinDate" type="date" defaultValue={defaultValues?.joinDate?.slice(0, 10)} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            <Textarea name="address" defaultValue={defaultValues?.address ?? ''} placeholder="Alamat lengkap" />
          </Field>
        </div>
      </div>

      {/* Account provisioning — create only */}
      {isCreate && (
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="text-base font-medium">Akun Login (opsional)</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Isi untuk membuat akun login karyawan. Email & password ini dipakai untuk masuk ke aplikasi.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.username}>
              <div className="flex items-center rounded-xl border border-border bg-card focus-within:ring-2 focus-within:ring-accent-purple/20">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  placeholder="budi"
                  className="h-9 w-full rounded-l-xl bg-transparent px-3 text-sm outline-none placeholder:text-ink-subtle"
                />
                <span className="select-none whitespace-nowrap px-3 text-sm text-ink-subtle">@{EMAIL_DOMAIN}</span>
              </div>
              {username && (
                <p className="mt-1 text-xs text-ink-subtle">Email: {username.toLowerCase()}@{EMAIL_DOMAIN}</p>
              )}
            </Field>
            <Field label="Password" error={errors.password}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>
      )}

      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="text-base font-medium">Penempatan</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Departemen">
            <Select name="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">— Pilih —</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Jabatan">
            <Select name="positionId" defaultValue={defaultValues?.position?.id ?? ''} disabled={!departmentId}>
              <option value="">— Pilih —</option>
              {positions?.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status Kerja">
            <Select name="workStatus" defaultValue={defaultValues?.workStatus ?? 'PROBATION'}>
              {WORK_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
