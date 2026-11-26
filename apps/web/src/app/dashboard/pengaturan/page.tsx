"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  History,
  ImagePlus,
  Languages,
  Plug,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useAuditLogs, type AuditLog } from "@/features/dashboard/api";
import {
  type UpdateCompanySetting,
  useCompanySetting,
  useUpdateCompanySetting,
} from "@/features/settings/api";
import { EmployeeStructureSettings } from "@/features/settings/employee-structure-settings";
import { ConfigurationTabs } from "@/features/settings/configuration-tabs";
import { NotificationSoundSettings } from "@/features/notifications/notification-sound-settings";
import { RolePermissionsSettings } from "@/features/rbac/role-permissions-settings";
import { useAuthStore } from "@/stores/auth-store";

type SettingsSection =
  | "company"
  | "organization"
  | "attendance"
  | "payroll"
  | "integration"
  | "notifications"
  | "roles"
  | "history";

const initialForm: UpdateCompanySetting = {
  companyName: "",
  locale: "vi-VN",
  currency: "VND",
  weekStartsOn: 1,
  trustedWebOrigins: ["https://chamcong.petshophanoi.com"],
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  APPROVE: "Phê duyệt",
  REJECT: "Từ chối",
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
  EXPORT: "Xuất dữ liệu",
};

export default function PengaturanPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canReadCompany = hasPermission("settings:read");
  const canReadAudit = hasPermission("audit:read");
  const [activeSection, setActiveSection] = useState<SettingsSection>("company");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [form, setForm] = useState<UpdateCompanySetting>(initialForm);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const {
    data: company,
    isLoading: isLoadingCompany,
    isError: companyError,
  } = useCompanySetting();
  const updateCompany = useUpdateCompanySetting();
  const { data: logs, isLoading: isLoadingLogs } = useAuditLogs({
    entity: entity || undefined,
    action: action || undefined,
  }, canReadAudit && activeSection === "history");

  const settingsSections = [
    { id: "company" as const, label: "Công ty", icon: Building2, enabled: canReadCompany },
    {
      id: "organization" as const,
      label: "Tổ chức",
      icon: BriefcaseBusiness,
      enabled: hasPermission("branch:read") || hasPermission("employee:read"),
    },
    { id: "attendance" as const, label: "Chấm công & ca làm", icon: ClipboardCheck, enabled: hasPermission("attendance-policy:read") },
    { id: "payroll" as const, label: "Bảng công & lương", icon: CalendarClock, enabled: hasPermission("payroll:read") },
    { id: "integration" as const, label: "Tích hợp & KPI", icon: Plug, enabled: hasPermission("integration:read") },
    { id: "notifications" as const, label: "Thông báo", icon: BellRing, enabled: true },
    { id: "roles" as const, label: "Vai trò & quyền", icon: ShieldCheck, enabled: hasPermission("rbac:read") },
    { id: "history" as const, label: "Lịch sử thao tác", icon: History, enabled: canReadAudit },
  ].filter((section) => section.enabled);

  useEffect(() => {
    if (!settingsSections.some((section) => section.id === activeSection)) {
      setActiveSection(settingsSections[0]?.id ?? "notifications");
    }
  }, [activeSection, settingsSections]);

  useEffect(() => {
    if (company) {
      setForm({
        companyName: company.companyName,
        locale: company.locale,
        currency: company.currency,
        weekStartsOn: company.weekStartsOn,
        trustedWebOrigins: company.trustedWebOrigins,
      });
      setLogoPreview(company.logoUrl ?? null);
    }
  }, [company]);

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        id: "actor",
        header: "Người thực hiện",
        cell: ({ row }) => row.original.actor?.fullName ?? "Hệ thống",
      },
      {
        accessorKey: "action",
        header: "Thao tác",
        cell: ({ row }) => <StatusBadge status={row.original.action} />,
      },
      {
        accessorKey: "entity",
        header: "Dữ liệu",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.entity}</span>
        ),
      },
      {
        id: "when",
        header: "Thời gian",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateCompany.mutate(form);
  };

  const selectLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo tối đa 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const logo = String(reader.result);
      setLogoPreview(logo);
      setForm({ ...form, logo, removeLogo: false });
      setLogoError("");
    };
    reader.onerror = () => setLogoError("Không thể đọc tệp logo. Vui lòng thử lại.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Công ty, vận hành và kiểm soát hệ thống"
      />

      <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="Danh mục cài đặt"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-card lg:sticky lg:top-24 lg:flex-col"
        >
          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-current={activeSection === section.id ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full ${activeSection === section.id ? "bg-accent-purple/10 text-purple-800" : "text-ink-muted hover:bg-canvas hover:text-ink"}`}
            >
              <section.icon className="size-4 shrink-0" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0">

      {activeSection === "company" && canReadCompany && <form
        onSubmit={onSubmit}
        className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-accent-purple/15 p-2 text-purple-700">
            <Building2 className="size-5" />
          </span>
          <h2 className="font-semibold text-ink">Thông tin công ty</h2>
        </div>
        {companyError ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Không thể tải cài đặt. Hãy kiểm tra quyền truy cập của tài khoản.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas/60 p-5">
                {logoPreview ? (
                  // logoPreview can be a FileReader data URL while the user is selecting a logo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Logo công ty"
                    className="size-28 rounded-2xl border border-border bg-card object-contain p-2"
                  />
                ) : (
                  <span className="flex size-28 items-center justify-center rounded-2xl bg-ink text-3xl font-semibold text-white">
                    {form.companyName.trim().charAt(0).toUpperCase() || "C"}
                  </span>
                )}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-canvas">
                    <ImagePlus className="size-4" /> Tải logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => selectLogo(event.target.files?.[0])}
                    />
                  </label>
                  {logoPreview ? (
                    <button
                      type="button"
                      aria-label="Gỡ logo"
                      title="Gỡ logo"
                      className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-ink-muted hover:bg-red-50 hover:text-red-600"
                      onClick={() => {
                        setLogoPreview(null);
                        setForm({ ...form, logo: undefined, removeLogo: true });
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                {logoError ? <p className="mt-2 text-center text-xs text-red-600">{logoError}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">
                  Tên công ty
                </span>
                <Input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="Tên công ty"
                  maxLength={120}
                  disabled={isLoadingCompany}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Languages className="size-4" /> Ngôn ngữ
                </span>
                <Select
                  value={form.locale}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      locale: e.target.value as UpdateCompanySetting["locale"],
                    })
                  }
                  disabled={isLoadingCompany}
                >
                  <option value="vi-VN">Tiếng Việt</option>
                  <option value="en-US">English</option>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-ink">Tiền tệ</span>
                <Select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      currency: e.target
                        .value as UpdateCompanySetting["currency"],
                    })
                  }
                  disabled={isLoadingCompany}
                >
                  <option value="VND">Việt Nam đồng (VND)</option>
                  <option value="USD">US Dollar (USD)</option>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-ink">
                  Ngày bắt đầu tuần
                </span>
                <Select
                  value={form.weekStartsOn}
                  onChange={(e) =>
                    setForm({ ...form, weekStartsOn: Number(e.target.value) })
                  }
                  disabled={isLoadingCompany}
                >
                  <option value={1}>Thứ Hai</option>
                  <option value={0}>Chủ Nhật</option>
                </Select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">
                  Domain ứng dụng
                </span>
                <textarea
                  value={form.trustedWebOrigins.join("\n")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      trustedWebOrigins: e.target.value
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  className="min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
                  placeholder="https://chamcong.petshophanoi.com"
                  disabled={isLoadingCompany}
                />
                <span className="text-xs text-ink-subtle">
                  Mỗi dòng một domain HTTPS.
                </span>
              </label>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={
              isLoadingCompany || updateCompany.isPending || !!companyError
            }
          >
            <Save /> {updateCompany.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
        {updateCompany.isError && (
          <p className="mt-3 text-sm text-red-600">
            {(() => {
              const message = (updateCompany.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
              return Array.isArray(message) ? message.join(", ") : message ?? "Không thể lưu cài đặt.";
            })()}
          </p>
        )}
        {updateCompany.isSuccess && (
          <p className="mt-3 text-sm text-emerald-700">
            Đã lưu cài đặt công ty.
          </p>
        )}
      </form>}

      {activeSection === "attendance" && (
        <ConfigurationTabs tabsToShow={["policy", "schedule"]} />
      )}

      {activeSection === "payroll" && (
        <ConfigurationTabs tabsToShow={["payroll"]} />
      )}

      {activeSection === "integration" && (
        <ConfigurationTabs tabsToShow={["integration"]} />
      )}

      {activeSection === "notifications" && <NotificationSoundSettings />}

      {activeSection === "organization" && <EmployeeStructureSettings />}

      {activeSection === "roles" && <RolePermissionsSettings />}

      {activeSection === "history" && canReadAudit && <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-canvas p-2 text-ink-muted">
            <History className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Nhật ký kiểm toán</h2>
            <p className="text-sm text-ink-muted">
              Theo dõi thay đổi cấu hình và dữ liệu hệ thống.
            </p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="w-full sm:w-52"
          >
            <option value="">Tất cả dữ liệu</option>
            <option value="CompanySetting">Cài đặt công ty</option>
            <option value="Attendance">Chấm công</option>
            <option value="Employee">Nhân viên</option>
          </Select>
          <Select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">Tất cả thao tác</option>
            {[
              "CREATE",
              "UPDATE",
              "DELETE",
              "APPROVE",
              "REJECT",
              "LOGIN",
              "LOGOUT",
              "EXPORT",
            ].map((value) => (
              <option key={value} value={value}>
                {AUDIT_ACTION_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={logs ?? []}
          loading={isLoadingLogs}
          searchPlaceholder="Tìm trong nhật ký…"
          emptyTitle="Chưa có nhật ký kiểm toán"
        />
      </section>}
        </div>
      </div>
    </div>
  );
}
