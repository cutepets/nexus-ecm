'use client';

import { useState } from 'react';
import { Folder as FolderIcon, FileText, Plus, Upload, ExternalLink, History } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import {
  useFolders,
  useDocuments,
  useDocument,
  useCreateFolder,
  useCreateDocument,
  useUploadVersion,
} from '@/features/documents/api';

export default function DokumenPage() {
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const { data: folders } = useFolders();
  const { data: docs, isLoading } = useDocuments(folderId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumen"
        description="Folder, dokumen, dan kontrol versi"
        action={<div className="flex gap-2"><FolderDialog /><DocDialog folderId={folderId} /></div>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-1 lg:col-span-1">
          <button
            onClick={() => setFolderId(undefined)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${!folderId ? 'bg-canvas font-medium' : 'text-ink-muted hover:bg-canvas'}`}
          >
            <FolderIcon className="size-4" /> Semua
          </button>
          {folders?.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderId(f.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${folderId === f.id ? 'bg-canvas font-medium' : 'text-ink-muted hover:bg-canvas'}`}
            >
              <span className="flex items-center gap-2"><FolderIcon className="size-4" /> {f.name}</span>
              <span className="text-xs text-ink-subtle">{f._count.documents}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {isLoading ? null : docs?.length ? (
            <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOpenDoc(d.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-canvas"
                >
                  <span className="flex items-center gap-3">
                    <FileText className="size-4 text-ink-subtle" />
                    <span>
                      <span className="block text-sm font-medium">{d.title}</span>
                      <span className="block text-xs text-ink-subtle">{d._count.versions} versi · {d._count.shares} dibagikan</span>
                    </span>
                  </span>
                  <StatusBadge status={d.docType} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada dokumen" description="Buat dokumen lalu unggah versinya." />
          )}
        </div>
      </div>

      <Dialog open={!!openDoc} onOpenChange={(o) => !o && setOpenDoc(null)}>
        <DialogContent className="p-6">{openDoc && <DocDetailView id={openDoc} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function DocDetailView({ id }: { id: string }) {
  const { data } = useDocument(id);
  const upload = useUploadVersion(id);
  if (!data) return null;
  return (
    <div>
      <DialogTitle className="text-lg font-medium">{data.title}</DialogTitle>
      <div className="mt-1 text-sm text-ink-subtle">{data.docType}</div>
      <div className="mt-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium"><History className="size-4" /> Versi</h4>
        <Button asChild variant="secondary" size="sm" disabled={upload.isPending}>
          <label className="cursor-pointer">
            <Upload /> {upload.isPending ? 'Mengunggah…' : 'Unggah Versi'}
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          </label>
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {data.versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-2 text-sm">
            <span>v{v.version} · {v.fileName}</span>
            <a href={v.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-purple-700 hover:underline">
              <ExternalLink className="size-3.5" /> Unduh
            </a>
          </li>
        ))}
        {!data.versions.length && <li className="py-2 text-sm text-ink-subtle">Belum ada versi.</li>}
      </ul>
    </div>
  );
}

function FolderDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateFolder();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Plus /> Folder</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Folder Baru</DialogTitle>
        <form
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ name: String(fd.get('name')) }, { onSuccess: () => setOpen(false) }); }}
          className="mt-4 space-y-4"
        >
          <div><Label>Nama</Label><Input name="name" required /></div>
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocDialog({ folderId }: { folderId?: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateDocument();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Dokumen</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Dokumen Baru</DialogTitle>
        <form
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ title: String(fd.get('title')), docType: String(fd.get('docType')), folderId }, { onSuccess: () => setOpen(false) }); }}
          className="mt-4 space-y-4"
        >
          <div><Label>Judul</Label><Input name="title" required /></div>
          <div><Label>Tipe</Label>
            <Select name="docType" defaultValue="OTHER">
              {['SOP', 'CONTRACT', 'INVOICE', 'LETTER', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={create.isPending}>Simpan</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
