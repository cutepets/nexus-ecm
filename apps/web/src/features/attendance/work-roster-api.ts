"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export interface RosterBranch { id: string; code: string; name: string }
export interface RosterEntry {
  id: string;
  workDate: string;
  workScheduleId: string;
  scheduleName: string;
  note?: string | null;
  source: string;
  employee: { id: string; fullName: string; employeeNo: string; photoUrl?: string | null; avatarUrl?: string | null };
  segments: Array<{ id: string; sequence: number; startTime: string; endTime: string; branch: RosterBranch }>;
}
export interface WorkRoster { month: string; rosterId?: string; branches: RosterBranch[]; entries: RosterEntry[] }
const key = (month: string) => ["attendance", "roster", month] as const;
const errorMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join("; ") : message ?? fallback;
};

export function useWorkRoster(month: string) {
  return useQuery({ queryKey: key(month), queryFn: async () => (await api.get<WorkRoster>("/attendance/roster", { params: { month } })).data });
}
export function useGenerateWorkRoster(month: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ generated: number }>("/attendance/roster/generate", { month })).data,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: key(month) });
      toast.success(result.generated > 0 ? `Đã tự động xếp ${result.generated} ca trong tháng.` : "Không có ca mới cần tự động xếp.");
    },
    onError: (error) => toast.error(errorMessage(error, "Không thể tự động xếp lịch tháng.")),
  });
}
export function useUpdateDailySchedule(month: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeId: string; workDate: string; workScheduleId: string; branchIds: string[]; note?: string }) => (await api.put("/attendance/roster/day", payload)).data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: key(month) });
      toast.success("Đã lưu ca làm việc.");
    },
    onError: (error) => toast.error(errorMessage(error, "Không thể lưu ca làm việc.")),
  });
}

export function useApplyWorkScheduleRange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeId: string; fromDate: string; toDate: string; workScheduleId: string; branchIds: string[] }) =>
      (await api.post<{ created: number; replaced: number; unchanged: number }>("/attendance/roster/range", payload)).data,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ["attendance", "roster"] });
      toast.success(`Đã thêm ${result.created}, đổi ${result.replaced}, giữ nguyên ${result.unchanged} ngày.`);
    },
  });
}

export function useBulkDeleteWorkRoster() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { workDates: string[]; branchId: string; employeeId?: string }) =>
      (await api.post<{ deleted: number; days: number }>("/attendance/roster/bulk-delete", payload)).data,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ["attendance", "roster"] });
      toast.success(`Đã xóa ${result.deleted} ca trong ${result.days} ngày đã chọn.`);
    },
    onError: (error) => toast.error(errorMessage(error, "Không thể xóa các ca đã chọn.")),
  });
}

export function useCopyWorkRosterDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { sourceDate: string; targetDates: string[]; branchId: string }) =>
      (await api.post<{ sourceEntries: number; targetDays: number; created: number; replaced: number }>("/attendance/roster/copy-day", payload)).data,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ["attendance", "roster"] });
      toast.success(`Đã sao chép ${result.sourceEntries} ca sang ${result.targetDays} ngày: thêm ${result.created}, ghi đè ${result.replaced}.`);
    },
  });
}
