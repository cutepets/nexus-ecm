'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Stage { id: string; name: string; probability: number }
export interface Lead { id: string; name: string; source?: string | null; status: string; owner?: { fullName: string } | null }
export interface Opportunity {
  id: string; title: string; value: string; stageId: string;
  customer?: { id: string; name: string } | null;
}
export interface BoardColumn { stage: Stage; count: number; value: number; opportunities: Opportunity[] }

export function useStages() {
  return useQuery({ queryKey: ['crm', 'stages'], queryFn: async () => (await api.get<Stage[]>('/crm/stages')).data });
}
export function useBoard() {
  return useQuery({ queryKey: ['crm', 'board'], queryFn: async () => (await api.get<BoardColumn[]>('/crm/opportunities/board')).data });
}
export function useLeads() {
  return useQuery({ queryKey: ['crm', 'leads'], queryFn: async () => (await api.get<Lead[]>('/crm/leads')).data });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/crm/leads', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'leads'] }); toast.success('Lead dibuat'); },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat lead')),
  });
}
export function useSetLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.put(`/crm/leads/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'leads'] }),
  });
}
export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/crm/opportunities', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'board'] }); toast.success('Peluang dibuat'); },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat peluang')),
  });
}
export function useMoveOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => (await api.put(`/crm/opportunities/${id}/stage`, { stageId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'board'] }),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
