"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export interface CompanySetting {
  id: string;
  companyName: string;
  logoUrl?: string | null;
  locale: "vi-VN" | "en-US";
  timezone: string;
  currency: "VND" | "USD";
  weekStartsOn: number;
  requireGps: boolean;
  livenessMode: "NONE" | "BLINK" | "TURN_HEAD" | "SMILE" | "NOD" | "RANDOM";
  faceDuplicateThreshold: number;
  auditRetentionDays: number;
  rosterAutoGenerateEnabled: boolean;
  rosterGenerationDay: number;
  trustedWebOrigins: string[];
  updatedAt: string;
}

export type UpdateCompanySetting = Pick<
  CompanySetting,
  | "companyName"
  | "locale"
  | "currency"
  | "weekStartsOn"
  | "trustedWebOrigins"
> & { logo?: string; removeLogo?: boolean };

export interface CompanyBranding {
  companyName: string;
  logoUrl?: string | null;
}

export interface StorageSettings {
  storageProvider: "MINIO" | "GOOGLE_DRIVE";
  googleDriveFolderId: string;
  googleDriveOAuthClientId: string;
  oauthClientSecretConfigured: boolean;
  oauthConnected: boolean;
  googleDriveOAuthEmail?: string | null;
  oauthRedirectUri: string;
  connectionVerified: boolean;
  connectionVerifiedAt?: string | null;
}

export function useStorageSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings", "storage"],
    queryFn: async () => (await api.get<StorageSettings>("/settings/storage")).data,
    enabled,
  });
}

export function useUpdateGoogleDriveOAuthSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: { clientId: string; clientSecret?: string; folderId: string }) =>
      (await api.put<StorageSettings>("/settings/storage/google-drive/oauth", settings)).data,
    onSuccess: (settings) => queryClient.setQueryData(["settings", "storage"], settings),
  });
}

export function useStartGoogleDriveOAuth() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ url: string; redirectUri: string }>("/settings/storage/google-drive/oauth/start")).data,
  });
}

export function useTestGoogleDriveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ connected: boolean; folderName: string; clientEmail: string }>("/settings/storage/google-drive/test")).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "storage"] }),
  });
}

export function useSelectStorageProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: "MINIO" | "GOOGLE_DRIVE") =>
      (await api.put<StorageSettings>("/settings/storage/provider", { provider })).data,
    onSuccess: (settings) => queryClient.setQueryData(["settings", "storage"], settings),
  });
}

function resolveLogoUrl<T extends { logoUrl?: string | null }>(value: T): T {
  return value.logoUrl
    ? { ...value, logoUrl: new URL(value.logoUrl, `${api.defaults.baseURL}/`).toString() }
    : value;
}
export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  displayOrder: number;
}
export type CreateBranch = Omit<Branch, "id" | "displayOrder"> & { displayOrder?: number };
export interface BranchLocation {
  id: string;
  branchId: string;
  code: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowRemote: boolean;
  isActive: boolean;
}
export type CreateBranchLocation = Omit<BranchLocation, "id" | "branchId">;
export interface AttendancePolicy {
  requireGps: boolean;
  livenessMode: CompanySetting["livenessMode"];
  faceDuplicateThreshold: number;
  auditRetentionDays: number;
  rosterAutoGenerateEnabled: boolean;
  rosterGenerationDay: number;
}
export interface PayrollSetting {
  payrollMode: "MONTHLY" | "HOURLY" | "SHIFT" | "HYBRID";
  workUnitMode: "DAILY" | "HOURLY";
  payrollCutoffDay: number;
  timesheetStartDay: number;
  timesheetEndDay: number;
  latePenaltyPerMinute: number;
  missingPunchPenalty: number;
  overtimeTriggerMinutes: number;
  overtimeMultiplier: number;
}
export interface IntegrationSetting {
  integrationApiEnabled: boolean;
  integrationAllowedOrigins: string[];
}
export interface IntegrationKpiField {
  id: string;
  key: string;
  label: string;
  fieldType: "NUMBER" | "TEXT" | "BOOLEAN";
  required: boolean;
  isActive: boolean;
  sortOrder: number;
}
export interface WorkSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  secondStartTime?: string | null;
  secondEndTime?: string | null;
  displayOrder: number;
}
export type WorkScheduleInput = Omit<WorkSchedule, "id" | "displayOrder"> & { displayOrder?: number };
export type EmploymentType =
  | "VAN_PHONG"
  | "CUA_HANG_POS"
  | "CONG_TRUONG"
  | "TU_XA"
  | "CA_KIP";

export function useCompanySetting() {
  return useQuery({
    queryKey: ["settings", "company"],
    queryFn: async () =>
      resolveLogoUrl((await api.get<CompanySetting>("/settings/company")).data),
  });
}

export function useCompanyBranding() {
  return useQuery({
    queryKey: ["settings", "branding"],
    queryFn: async () =>
      resolveLogoUrl((await api.get<CompanyBranding>("/settings/branding")).data),
    staleTime: 30 * 60 * 1000,
  });
}

export function useUpdateCompanySetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (setting: UpdateCompanySetting) =>
      resolveLogoUrl((await api.put<CompanySetting>("/settings/company", setting)).data),
    onSuccess: (setting) => {
      queryClient.setQueryData(["settings", "company"], setting);
      queryClient.setQueryData(["settings", "branding"], {
        companyName: setting.companyName,
        logoUrl: setting.logoUrl,
      });
    },
  });
}

export function useBranches(enabled = true) {
  return useQuery({
    queryKey: ["settings", "branches"],
    queryFn: async () => (await api.get<Branch[]>("/settings/branches")).data,
    enabled,
  });
}
export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: CreateBranch) =>
      (await api.post<Branch>("/settings/branches", branch)).data,
    onSuccess: (branch) => {
      queryClient.setQueryData<Branch[]>(
        ["settings", "branches"],
        (items = []) => [...items, branch],
      );
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    },
  });
}
export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: Partial<CreateBranch>) =>
      (await api.put<Branch>(`/settings/branches/${id}`, branch)).data,
    onSuccess: (branch) => {
      queryClient.setQueryData<Branch[]>(
        ["settings", "branches"],
        (items = []) =>
          items.map((item) => (item.id === branch.id ? branch : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    },
  });
}
export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/settings/branches/${id}`)).data,
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Branch[]>(
        ["settings", "branches"],
        (items = []) => items.filter((item) => item.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    },
  });
}
export function useReorderBranches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branchIds: string[]) =>
      (await api.put<Branch[]>("/settings/branches/order", { branchIds })).data,
    onSuccess: (branches) => {
      queryClient.setQueryData(["settings", "branches"], branches);
      toast.success("Đã lưu thứ tự chi nhánh.");
    },
    onError: () => toast.error("Không thể lưu thứ tự chi nhánh."),
  });
}
function useSettingMutation<T>(path: string, queryKey: string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: T) => (await api.put(path, value)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useAttendancePolicy() {
  return useQuery({
    queryKey: ["settings", "attendance-policy"],
    queryFn: async () =>
      (await api.get<AttendancePolicy>("/settings/attendance-policy")).data,
  });
}
export function useUpdateAttendancePolicy() {
  return useSettingMutation<Partial<AttendancePolicy>>(
    "/settings/attendance-policy",
    ["settings", "attendance-policy"],
  );
}
export function useEmploymentTypes() {
  return useQuery({
    queryKey: ["settings", "employment-types"],
    queryFn: async () =>
      (
        await api.get<{ employmentTypes: EmploymentType[] }>(
          "/settings/employment-types",
        )
      ).data,
  });
}
export function useUpdateEmploymentTypes() {
  return useSettingMutation<{ employmentTypes: EmploymentType[] }>(
    "/settings/employment-types",
    ["settings", "employment-types"],
  );
}
export function usePayrollSetting() {
  return useQuery({
    queryKey: ["settings", "payroll"],
    queryFn: async () =>
      (await api.get<PayrollSetting>("/settings/payroll")).data,
  });
}
export function useUpdatePayrollSetting() {
  return useSettingMutation<Partial<PayrollSetting>>("/settings/payroll", [
    "settings",
    "payroll",
  ]);
}
export function useIntegrationSetting() {
  return useQuery({
    queryKey: ["settings", "integration"],
    queryFn: async () =>
      (await api.get<IntegrationSetting>("/settings/integration")).data,
  });
}
export function useUpdateIntegrationSetting() {
  return useSettingMutation<Partial<IntegrationSetting>>(
    "/settings/integration",
    ["settings", "integration"],
  );
}
export function useIntegrationKpiFields() {
  return useQuery({
    queryKey: ["integrations", "kpi-fields"],
    queryFn: async () =>
      (
        await api.get<IntegrationKpiField[]>(
          "/integrations/api-keys/kpi-fields",
        )
      ).data,
  });
}
export function useCreateIntegrationKpiField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      field: Omit<IntegrationKpiField, "id" | "isActive"> & {
        isActive?: boolean;
      },
    ) =>
      (
        await api.post<IntegrationKpiField>(
          "/integrations/api-keys/kpi-fields",
          field,
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["integrations", "kpi-fields"],
      }),
  });
}
export function useDeleteIntegrationKpiField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/integrations/api-keys/kpi-fields/${id}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["integrations", "kpi-fields"],
      }),
  });
}
export function useWorkSchedules(enabled = true) {
  return useQuery({
    queryKey: ["settings", "work-schedules"],
    queryFn: async () =>
      (await api.get<WorkSchedule[]>("/attendance/schedules")).data,
    enabled,
  });
}
export function useCreateWorkSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: WorkScheduleInput) =>
      (await api.post<WorkSchedule>("/attendance/schedules", schedule)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["settings", "work-schedules"],
      }),
  });
}
export function useUpdateWorkSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...schedule }: WorkSchedule) =>
      (await api.put<WorkSchedule>(`/attendance/schedules/${id}`, schedule))
        .data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["settings", "work-schedules"],
      }),
  });
}
export function useDeleteWorkSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/attendance/schedules/${id}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["settings", "work-schedules"],
      }),
  });
}
export function useReorderWorkSchedules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleIds: string[]) =>
      (await api.put<WorkSchedule[]>("/attendance/schedules/order", { scheduleIds })).data,
    onSuccess: (schedules) => {
      queryClient.setQueryData(["settings", "work-schedules"], schedules);
      toast.success("Đã lưu thứ tự ca làm.");
    },
    onError: () => toast.error("Không thể lưu thứ tự ca làm."),
  });
}
