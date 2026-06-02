'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { useLeaveTypes, useCreateLeave, uploadLeaveDoc } from '@/features/leave/api';

export default function NewLeavePage() {
  const router = useRouter();
  const { data: types } = useLeaveTypes();
  const create = useCreateLeave();

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [docKey, setDocKey] = useState<string | null>(null);

  const selectedType = types?.find((t) => t.id === leaveTypeId);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setDocKey(await uploadLeaveDoc(file));
      toast.success('Dokumen terunggah');
    } catch {
      toast.error('Gagal mengunggah dokumen');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!employeeId || !leaveTypeId) {
      toast.error('Pilih karyawan dan jenis cuti');
      return;
    }
    create.mutate(
      {
        employeeId,
        leaveTypeId,
        startDate: String(fd.get('startDate')),
        endDate: String(fd.get('endDate')),
        reason: String(fd.get('reason')),
        documentUrl: docKey ?? undefined,
      },
      { onSuccess: (r) => router.push(`/dashboard/cuti/${r.id}`) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ajukan Cuti" description="Lengkapi formulir pengajuan cuti/izin" />
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
            </div>
            <div>
              <Label>Jenis Cuti</Label>
              <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                <option value="">— Pilih —</option>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.defaultQuota > 0 ? ` (kuota ${t.defaultQuota})` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div />
            <div>
              <Label>Tanggal Mulai</Label>
              <Input name="startDate" type="date" required />
            </div>
            <div>
              <Label>Tanggal Selesai</Label>
              <Input name="endDate" type="date" required />
            </div>
            <div className="sm:col-span-2">
              <Label>Alasan</Label>
              <Textarea name="reason" required placeholder="Jelaskan alasan pengajuan" />
            </div>
            {selectedType?.requiresDoc && (
              <div className="sm:col-span-2">
                <Label>Dokumen Pendukung (wajib)</Label>
                <Button asChild variant="secondary" disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload /> {uploading ? 'Mengunggah…' : docKey ? 'Ganti file' : 'Unggah file'}
                    <input type="file" className="hidden" onChange={onFile} />
                  </label>
                </Button>
                {docKey && <span className="ml-3 text-xs text-emerald-600">Terunggah ✓</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Batal
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Mengirim…' : 'Kirim Pengajuan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
