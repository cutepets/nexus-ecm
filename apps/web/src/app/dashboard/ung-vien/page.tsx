'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCandidateBranches,
  useCandidates,
  useCreateCandidate,
  useDeleteCandidate,
  useUpdateCandidate,
  uploadCandidatePhoto,
  type Candidate,
  type CandidateInput,
  type CandidateStatus,
  CANDIDATE_STATUS_OPTIONS,
} from '@/features/candidates/api';

function initials(name: string) {
  return name.split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join('');
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa xác định';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : 'Chưa xác định';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CandidatesPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { data: candidates = [], isLoading, isError } = useCandidates();
  const { data: branches = [] } = useCandidateBranches();
  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const canCreate = hasPermission('candidate:create');
  const canUpdate = hasPermission('candidate:update');
  const canDelete = hasPermission('candidate:delete');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formInstance, setFormInstance] = useState(0);

  useEffect(() => {
    if (!photoPreview?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const openCreate = () => {
    setFormInstance((instance) => instance + 1);
    setEditing(null);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setDialogOpen(true);
  };

  const openEdit = (candidate: Candidate) => {
    setFormInstance((instance) => instance + 1);
    setEditing(candidate);
    setSelectedPhoto(null);
    setPhotoPreview(candidate.photoUrl);
    setRemovePhoto(false);
    setDialogOpen(true);
  };

  const submitCandidate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input: CandidateInput = {
      fullName: String(values.get('fullName') ?? '').trim(),
      phone: String(values.get('phone') ?? '').trim(),
      address: String(values.get('address') ?? '').trim(),
      desiredBranchIds: values.getAll('desiredBranchIds').map(String),
      desiredShift: String(values.get('desiredShift') ?? '').trim(),
      desiredStartDate: String(values.get('desiredStartDate') ?? ''),
      source: String(values.get('source') ?? '').trim(),
      notes: String(values.get('notes') ?? '').trim(),
    };

    setSaving(true);
    try {
      if (selectedPhoto) input.photoKey = await uploadCandidatePhoto(selectedPhoto);
      else if (removePhoto) input.photoKey = '';

      if (editing) await updateCandidate.mutateAsync({ id: editing.id, ...input });
      else await createCandidate.mutateAsync(input);
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && !('response' in error)) toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Candidate>[]>(() => [
    {
      accessorKey: 'fullName',
      header: 'Ứng viên',
      size: 220,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border border-border">
            <AvatarImage src={row.original.photoUrl ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{initials(row.original.fullName)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.original.fullName}</span>
        </div>
      ),
    },
    { accessorKey: 'phone', header: 'Số điện thoại', size: 140 },
    {
      accessorKey: 'address',
      header: 'Địa chỉ',
      size: 220,
      cell: ({ row }) => <span className="line-clamp-2">{row.original.address || '—'}</span>,
    },
    {
      id: 'desiredBranch',
      header: 'Chi nhánh mong muốn',
      size: 180,
      cell: ({ row }) => row.original.desiredBranches.length
        ? row.original.desiredBranches.map((branch) => branch.name).join(', ')
        : '—',
    },
    { accessorKey: 'desiredShift', header: 'Ca mong muốn', size: 130, cell: ({ row }) => row.original.desiredShift || '—' },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      size: 170,
      cell: ({ row }) => {
        const candidate = row.original;
        const label = CANDIDATE_STATUS_OPTIONS.find((option) => option.value === candidate.status)?.label ?? 'Xét duyệt';
        const tone = candidate.status === 'APPROVED' ? 'mint' : candidate.status === 'FOLLOW_UP' ? 'cyan' : candidate.status === 'REJECTED' ? 'red' : 'amber';
        const color = candidate.status === 'APPROVED'
          ? 'border-emerald-200 bg-accent-mint/20 text-emerald-700'
          : candidate.status === 'FOLLOW_UP'
            ? 'border-cyan-200 bg-accent-cyan/20 text-cyan-700'
            : candidate.status === 'REJECTED'
              ? 'border-red-200 bg-red-100 text-red-700'
              : 'border-amber-200 bg-amber-100 text-amber-700';
        return canUpdate ? (
          <Select
            aria-label={`Trạng thái ${candidate.fullName}`}
            value={candidate.status}
            disabled={updateCandidate.isPending}
            className={`h-8 min-w-32 font-medium ${color}`}
            onChange={(event) => updateCandidate.mutate({ id: candidate.id, status: event.target.value as CandidateStatus })}
          >
            {CANDIDATE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value} className={color}>{option.label}</option>)}
          </Select>
        ) : <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'desiredStartDate',
      header: 'Ngày bắt đầu',
      size: 120,
      cell: ({ row }) => formatDate(row.original.desiredStartDate),
    },
    { accessorKey: 'source', header: 'Nguồn tuyển', size: 140, cell: ({ row }) => row.original.source || '—' },
    {
      accessorKey: 'notes',
      header: 'Nhận xét',
      size: 240,
      cell: ({ row }) => <span className="line-clamp-2 text-ink-muted">{row.original.notes || '—'}</span>,
    },
    {
      id: 'createdBy',
      header: 'Người tạo',
      size: 170,
      cell: ({ row }) => row.original.createdBy?.fullName || '—',
    },
    {
      accessorKey: 'createdAt',
      header: 'Thời gian tạo',
      size: 165,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      size: 104,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {canUpdate && (
            <Button variant="ghost" size="icon" aria-label={`Sửa ${row.original.fullName}`} onClick={() => openEdit(row.original)}>
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" aria-label={`Xóa ${row.original.fullName}`} onClick={() => setDeleting(row.original)}>
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ], [canDelete, canUpdate]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ứng viên"
        description="Danh sách theo dõi tuyển dụng tạm thời, tách biệt với hồ sơ nhân viên."
        action={canCreate ? <Button onClick={openCreate}><Plus /> Thêm ứng viên</Button> : undefined}
      />
      <DataTable
        tableId="candidate-list"
        columns={columns}
        data={isError ? [] : candidates}
        loading={isLoading}
        pageSize={25}
        minTableWidth={1500}
        searchPlaceholder="Tìm theo tên, số điện thoại, địa chỉ, nguồn tuyển..."
        emptyTitle={isError ? 'Không tải được danh sách ứng viên' : 'Chưa có ứng viên'}
        emptyDescription={isError ? 'Kiểm tra kết nối rồi thử tải lại.' : 'Thêm ứng viên để bắt đầu theo dõi.'}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
          <DialogTitle>{editing ? 'Sửa ứng viên' : 'Thêm ứng viên'}</DialogTitle>
          <DialogDescription className="mt-1">Thông tin này chỉ dùng để theo dõi tuyển dụng, chưa tạo hồ sơ nhân viên.</DialogDescription>
          <form key={`${editing?.id ?? 'new-candidate'}-${formInstance}`} className="mt-5 space-y-4" onSubmit={submitCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Họ và tên <span className="text-red-600">*</span>
                <Input name="fullName" required minLength={2} maxLength={120} defaultValue={editing?.fullName ?? ''} autoFocus />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Số điện thoại <span className="text-red-600">*</span>
                <Input name="phone" type="tel" required maxLength={24} defaultValue={editing?.phone ?? ''} placeholder="0901234567" />
              </label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Địa chỉ
                <Input name="address" maxLength={500} defaultValue={editing?.address ?? ''} placeholder="Tỉnh/thành, quận/huyện..." />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-sm font-medium" htmlFor="candidate-photo">Ảnh ứng viên (không bắt buộc)</label>
                <div className="flex flex-wrap items-center gap-3">
                  {photoPreview ? (
                    <Avatar className="size-16 rounded-xl border border-border">
                      <AvatarImage src={photoPreview} alt="Ảnh xem trước của ứng viên" />
                      <AvatarFallback>{initials(editing?.fullName ?? 'Ứng viên')}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-border bg-canvas text-ink-subtle"><ImagePlus className="size-5" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Input
                      id="candidate-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedPhoto(file);
                        setRemovePhoto(false);
                        setPhotoPreview(file ? URL.createObjectURL(file) : editing?.photoUrl ?? null);
                      }}
                    />
                    <p className="mt-1 text-xs text-ink-muted">JPG, PNG hoặc WebP, tối đa 5 MB.</p>
                  </div>
                  {editing?.photoKey && !removePhoto && (
                    <Button type="button" variant="ghost" size="icon" aria-label="Xóa ảnh ứng viên" onClick={() => { setRemovePhoto(true); setSelectedPhoto(null); setPhotoPreview(null); }}>
                      <X />
                    </Button>
                  )}
                  {removePhoto && <span className="text-xs text-ink-muted">Ảnh sẽ được gỡ khi lưu.</span>}
                </div>
              </div>
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">Chi nhánh mong muốn</legend>
                {branches.length ? (
                  <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">
                    {branches.map((branch) => (
                      <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                        <input
                          type="checkbox"
                          name="desiredBranchIds"
                          value={branch.id}
                          defaultChecked={editing?.desiredBranches.some((selected) => selected.id === branch.id)}
                          className="size-4 accent-purple-700"
                        />
                        {branch.name}
                      </label>
                    ))}
                  </div>
                ) : <p className="rounded-xl border border-border p-3 text-sm text-ink-muted">Chưa có chi nhánh đang hoạt động.</p>}
              </fieldset>
              <label className="space-y-1.5 text-sm font-medium">
                Ca mong muốn
                <Input name="desiredShift" maxLength={120} defaultValue={editing?.desiredShift ?? ''} placeholder="Ca sáng, ca tối..." />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Ngày muốn bắt đầu
                <Input name="desiredStartDate" type="date" defaultValue={editing?.desiredStartDate?.slice(0, 10) ?? ''} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Nguồn tuyển
                <Input name="source" maxLength={120} defaultValue={editing?.source ?? ''} placeholder="Giới thiệu, Facebook..." />
              </label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Nhận xét
                <Textarea name="notes" maxLength={4000} rows={3} defaultValue={editing?.notes ?? ''} placeholder="Kinh nghiệm, trao đổi, lịch hẹn..." />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu ứng viên' : 'Thêm ứng viên'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleting}
        title="Xóa ứng viên"
        description={`Xóa ${deleting?.fullName ?? 'ứng viên'} khỏi danh sách theo dõi?`}
        pending={deleteCandidate.isPending}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onConfirm={() => {
          if (!deleting) return;
          deleteCandidate.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
