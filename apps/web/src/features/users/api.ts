'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystem?: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: { id: string; employeeNo: string; fullName: string } | null;
  roles: RoleOption[];
}

export interface UserAccountFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  roleId?: string;
}

export interface AccountPayload {
  username: string;
  email: string;
  phone?: string;
  fullName: string;
  password?: string;
  roleIds?: string[];
  currentPassword?: string;
}

interface PaginatedAccounts { items: UserAccount[]; total: number; page: number; pageSize: number; totalPages: number; }

const keys = {
  all: ['user-accounts'] as const,
  list: (filters: UserAccountFilters) => ['user-accounts', 'list', filters] as const,
  roles: ['user-accounts', 'roles'] as const,
};

function errMsg(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message ?? fallback;
}

export function useUserAccounts(filters: UserAccountFilters) {
  return useQuery({ queryKey: keys.list(filters), queryFn: async () => (await api.get<PaginatedAccounts>('/users', { params: filters })).data });
}

export function useAccountRoleOptions(enabled: boolean) {
  return useQuery({ queryKey: keys.roles, queryFn: async () => (await api.get<RoleOption[]>('/users/roles/options')).data, enabled });
}

function invalidateAccounts(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: keys.all });
}

export function useCreateUserAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AccountPayload & { password: string; roleIds: string[]; currentPassword: string }) => (await api.post<UserAccount>('/users', payload)).data,
    onSuccess: () => { void invalidateAccounts(queryClient); toast.success('Đã tạo tài khoản'); },
    onError: (error) => toast.error(errMsg(error, 'Không thể tạo tài khoản')),
  });
}

export function useUpdateUserAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Omit<AccountPayload, 'password' | 'roleIds' | 'currentPassword'> }) => (await api.patch<UserAccount>(`/users/${id}`, payload)).data,
    onSuccess: () => { void invalidateAccounts(queryClient); toast.success('Đã lưu tài khoản'); },
    onError: (error) => toast.error(errMsg(error, 'Không thể lưu tài khoản')),
  });
}

export function useSetUserRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, roleIds, currentPassword }: { id: string; roleIds: string[]; currentPassword: string }) => (await api.put<UserAccount>(`/users/${id}/roles`, { roleIds, currentPassword })).data,
    onSuccess: () => { void invalidateAccounts(queryClient); toast.success('Đã cập nhật vai trò và thu hồi phiên cũ'); },
    onError: (error) => toast.error(errMsg(error, 'Không thể cập nhật vai trò')),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive, currentPassword }: { id: string; isActive: boolean; currentPassword: string }) => (await api.put<UserAccount>(`/users/${id}/status`, { isActive, currentPassword })).data,
    onSuccess: (_, variables) => { void invalidateAccounts(queryClient); toast.success(variables.isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản và thu hồi phiên'); },
    onError: (error) => toast.error(errMsg(error, 'Không thể đổi trạng thái tài khoản')),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password, currentPassword }: { id: string; password: string; currentPassword: string }) => (await api.post<{ success: boolean }>(`/users/${id}/reset-password`, { password, currentPassword })).data,
    onSuccess: () => toast.success('Đã đặt lại mật khẩu và thu hồi mọi phiên đăng nhập'),
    onError: (error) => toast.error(errMsg(error, 'Không thể đặt lại mật khẩu')),
  });
}

export function useRevokeUserSessions() {
  return useMutation({
    mutationFn: async ({ id, currentPassword }: { id: string; currentPassword: string }) => (await api.post<{ success: boolean }>(`/users/${id}/revoke-sessions`, { currentPassword })).data,
    onSuccess: () => toast.success('Đã thu hồi toàn bộ phiên đăng nhập'),
    onError: (error) => toast.error(errMsg(error, 'Không thể thu hồi phiên đăng nhập')),
  });
}

export function useSoftDeleteUserAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentPassword }: { id: string; currentPassword: string }) =>
      (await api.delete<{ success: boolean }>(`/users/${id}`, { data: { currentPassword } })).data,
    onSuccess: () => { void invalidateAccounts(queryClient); toast.success('Đã xóa mềm tài khoản và thu hồi phiên'); },
    onError: (error) => toast.error(errMsg(error, 'Không thể xóa tài khoản')),
  });
}
