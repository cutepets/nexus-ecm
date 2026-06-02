'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Upload, Plus, FileText, ExternalLink } from 'lucide-react';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useEmployee,
  useDeleteEmployee,
  useAddSalaryHistory,
  useUploadDocument,
  useDeleteDocument,
} from '@/features/employees/api';

const DOC_TYPES = ['KTP', 'NPWP', 'CV', 'CONTRACT', 'OTHER'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useEmployee(id);
  const del = useDeleteEmployee();

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-card" />;
  }

  const onDelete = () => {
    if (!confirm(`Nonaktifkan karyawan "${data.fullName}"?`)) return;
    del.mutate(id, { onSuccess: () => router.push('/dashboard/karyawan') });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detail Karyawan"
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href={`/dashboard/karyawan/${id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={del.isPending}>
              <Trash2 /> Nonaktifkan
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-6 shadow-card">
        <Avatar className="size-16">
          {data.photoUrl && <AvatarImage src={data.photoUrl} alt={data.fullName} />}
          <AvatarFallback className="text-lg">{initials(data.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-medium">{data.fullName}</h2>
            <StatusBadge status={data.workStatus} />
          </div>
          <p className="text-sm text-ink-muted">
            {data.employeeNo} · {data.position?.title ?? 'Tanpa jabatan'} ·{' '}
            {data.department?.name ?? 'Tanpa departemen'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="jobs">Riwayat Jabatan</TabsTrigger>
          <TabsTrigger value="salary">Riwayat Gaji</TabsTrigger>
          <TabsTrigger value="docs">Dokumen</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-2">
            <InfoRow label="Email" value={data.email} />
            <InfoRow label="Telepon" value={data.phone} />
            <InfoRow label="Alamat" value={data.address} />
            <InfoRow label="Manajer" value={data.manager?.fullName} />
            <InfoRow label="Tanggal Bergabung" value={formatDate(data.joinDate)} />
            <InfoRow label="Tanggal Keluar" value={data.exitDate ? formatDate(data.exitDate) : null} />
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          {data.jobHistory.length ? (
            <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
              {data.jobHistory.map((j) => (
                <div key={j.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
                  <div>
                    <div className="text-sm font-medium">
                      {j.position?.title ?? '—'} {j.department ? `· ${j.department.name}` : ''}
                    </div>
                    {j.note && <div className="text-xs text-ink-subtle">{j.note}</div>}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatDate(j.startDate)} – {j.endDate ? formatDate(j.endDate) : 'sekarang'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada riwayat jabatan" />
          )}
        </TabsContent>

        <TabsContent value="salary">
          <SalaryTab employeeId={id} entries={data.salaryHistory} />
        </TabsContent>

        <TabsContent value="docs">
          <DocsTab employeeId={id} documents={data.documents} />
        </TabsContent>
      </Tabs>
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

function SalaryTab({
  employeeId,
  entries,
}: {
  employeeId: string;
  entries: { id: string; amount: string; currency: string; effectiveDate: string; reason?: string | null }[];
}) {
  const add = useAddSalaryHistory(employeeId);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    add.mutate(
      {
        amount: String(fd.get('amount')),
        effectiveDate: String(fd.get('effectiveDate')),
        reason: String(fd.get('reason') || ''),
      },
      { onSuccess: () => (e.target as HTMLFormElement).reset() },
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4 shadow-card">
        <div className="w-40">
          <Label>Nominal (IDR)</Label>
          <Input name="amount" type="number" min="0" step="any" required placeholder="12000000" />
        </div>
        <div className="w-44">
          <Label>Berlaku Sejak</Label>
          <Input name="effectiveDate" type="date" required />
        </div>
        <div className="min-w-40 flex-1">
          <Label>Keterangan</Label>
          <Input name="reason" placeholder="Kenaikan tahunan" />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <Plus /> Tambah
        </Button>
      </form>

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
        <EmptyState title="Belum ada riwayat gaji" />
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
          <Label>Jenis Dokumen</Label>
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <Button asChild variant="secondary" disabled={upload.isPending}>
          <label className="cursor-pointer">
            <Upload /> {upload.isPending ? 'Mengunggah…' : 'Unggah File'}
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
                    {d.docType} · {d.status}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label="Buka">
                    <ExternalLink />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(d.id)} aria-label="Hapus">
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Belum ada dokumen" description="Unggah KTP, NPWP, CV, atau kontrak." />
      )}
    </div>
  );
}
