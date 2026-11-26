'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Permission { id: string; key: string; module: string; description?: string | null; }
export interface Role { id: string; name: string; description?: string | null; isSystem: boolean; permissions: { permission: Permission }[]; _count: { users: number }; }
export interface RoleAssignmentRule { id: string; name: string; departmentId: string | null; positionId: string | null; branchId: string | null; roleId: string; isActive: boolean; role: { id: string; name: string }; }
const key = ['rbac'] as const;
const error = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? fallback;

export function useRoles() { return useQuery({ queryKey: [...key, 'roles'], queryFn: async () => (await api.get<Role[]>('/rbac/roles')).data }); }
export function usePermissions() { return useQuery({ queryKey: [...key, 'permissions'], queryFn: async () => (await api.get<Permission[]>('/rbac/permissions')).data }); }
export function useRoleAssignmentRules() { return useQuery({ queryKey: [...key, 'assignment-rules'], queryFn: async () => (await api.get<RoleAssignmentRule[]>('/rbac/role-assignment-rules')).data }); }
export function useReplaceRoleAssignmentRules() { const qc = useQueryClient(); return useMutation({ mutationFn: async (rules: Omit<RoleAssignmentRule, 'id' | 'role'>[]) => (await api.put<RoleAssignmentRule[]>('/rbac/role-assignment-rules', { rules })).data, onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Đã lưu điều kiện tự gán vai trò'); }, onError: (e) => toast.error(String(error(e, 'Không thể lưu điều kiện tự gán vai trò'))) }); }

export function useCreateRole() { const qc = useQueryClient(); return useMutation({ mutationFn: async (data: { name: string; description?: string }) => (await api.post<Role>('/rbac/roles', data)).data, onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Đã tạo role'); }, onError: (e) => toast.error(String(error(e, 'Không thể tạo role'))) }); }
export function useUpdateRole() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string }) => (await api.patch<Role>(`/rbac/roles/${id}`, data)).data, onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Đã cập nhật role'); }, onError: (e) => toast.error(String(error(e, 'Không thể cập nhật role'))) }); }
export function useSetRolePermissions() { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, permissionKeys }: { id: string; permissionKeys: string[] }) => (await api.put(`/rbac/roles/${id}/permissions`, { permissionKeys })).data, onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Đã lưu quyền'); }, onError: (e) => toast.error(String(error(e, 'Không thể lưu quyền'))) }); }
export function useDeleteRole() { const qc = useQueryClient(); return useMutation({ mutationFn: async (id: string) => api.delete(`/rbac/roles/${id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Đã xóa role'); }, onError: (e) => toast.error(String(error(e, 'Không thể xóa role'))) }); }
