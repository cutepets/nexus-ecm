'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Folder { id: string; name: string; _count: { children: number; documents: number } }
export interface DocItem {
  id: string; title: string; docType: string; updatedAt: string;
  folder?: { id: string; name: string } | null;
  versions: { id: string; version: number }[];
  _count: { versions: number; shares: number };
}
export interface DocVersion { id: string; version: number; fileName: string; downloadUrl: string; uploadedAt: string; uploadedBy?: { fullName: string } | null }
export interface DocDetail extends Omit<DocItem, 'versions'> { versions: DocVersion[]; shares: { id: string; access: string; sharedWith: { fullName: string } }[] }

export function useFolders(parentId?: string) {
  return useQuery({ queryKey: ['folders', parentId ?? 'root'], queryFn: async () => (await api.get<Folder[]>('/documents/folders', { params: parentId ? { parentId } : undefined })).data });
}
export function useDocuments(folderId?: string) {
  return useQuery({ queryKey: ['documents', folderId ?? 'all'], queryFn: async () => (await api.get<DocItem[]>('/documents', { params: folderId ? { folderId } : undefined })).data });
}
export function useDocument(id: string) {
  return useQuery({ queryKey: ['documents', 'detail', id], queryFn: async () => (await api.get<DocDetail>(`/documents/${id}`)).data, enabled: !!id });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/documents/folders', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folders'] }); toast.success('Folder dibuat'); },
  });
}
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/documents', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Dokumen dibuat'); },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat dokumen')),
  });
}

/** Upload a new version: create document (if needed) → presign → PUT → addVersion. */
export function useUploadVersion(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { data: presign } = await api.post<{ url: string; key: string }>('/documents/uploads', { fileName: file.name });
      await fetch(presign.url, { method: 'PUT', body: file });
      return (await api.post(`/documents/${documentId}/versions`, { fileUrl: presign.key, fileName: file.name, sizeBytes: file.size })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Versi diunggah');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mengunggah versi')),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
