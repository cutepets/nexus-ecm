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

const WORK_STATUS: { value: string; label: string }[] = [
  { value: 'PROBATION', label: 'Probation' },
  { value: 'PERMANENT', label: 'Tetap' },
  { value: 'CONTRACT', label: 'Kontrak' },
  { value: 'INACTIVE', label: 'Nonaktif' },
];

const schema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  workStatus: z.string(),
  joinDate: z.string().min(1, 'Tanggal bergabung wajib diisi'),
});

export type EmployeeFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<EmployeeDetail>;
  submitting?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}

export function EmployeeForm({ defaultValues, submitting, onSubmit }: Props) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(defaultValues?.department?.id ?? '');
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
    setErrors({});
    // Drop empty strings so the API doesn't store blanks.
    const payload = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== ''),
    );
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
          <Field label="Email" error={errors.email}>
            <Input name="email" type="email" defaultValue={defaultValues?.email ?? ''} placeholder="budi@perusahaan.com" />
          </Field>
          <Field label="Telepon">
            <Input name="phone" defaultValue={defaultValues?.phone ?? ''} placeholder="08xx" />
          </Field>
          <Field label="Tanggal Bergabung" error={errors.joinDate} required>
            <Input
              name="joinDate"
              type="date"
              defaultValue={defaultValues?.joinDate?.slice(0, 10)}
            />
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            <Textarea name="address" defaultValue={defaultValues?.address ?? ''} placeholder="Alamat lengkap" />
          </Field>
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="text-base font-medium">Penempatan</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Departemen">
            <Select
              name="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">— Pilih —</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jabatan">
            <Select name="positionId" defaultValue={defaultValues?.position?.id ?? ''} disabled={!departmentId}>
              <option value="">— Pilih —</option>
              {positions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status Kerja">
            <Select name="workStatus" defaultValue={defaultValues?.workStatus ?? 'PROBATION'}>
              {WORK_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan'}
        </Button>
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
