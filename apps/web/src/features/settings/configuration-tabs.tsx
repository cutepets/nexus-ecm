"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  type AttendancePolicy,
  type IntegrationKpiField,
  type IntegrationSetting,
  type PayrollSetting,
  type WorkSchedule,
  useAttendancePolicy,
  useCreateIntegrationKpiField,
  useCreateWorkSchedule,
  useDeleteIntegrationKpiField,
  useDeleteWorkSchedule,
  useIntegrationKpiFields,
  useIntegrationSetting,
  usePayrollSetting,
  useUpdateAttendancePolicy,
  useUpdateIntegrationSetting,
  useUpdatePayrollSetting,
  useUpdateWorkSchedule,
  useReorderWorkSchedules,
  useWorkSchedules,
} from "./api";
import { useAuthStore } from "@/stores/auth-store";

type Tab = "policy" | "schedule" | "payroll" | "integration";
const tabs: { id: Tab; label: string; permission: string }[] = [
  { id: "policy", label: "Chấm công", permission: "attendance-policy:read" },
  { id: "schedule", label: "Ca làm", permission: "attendance-policy:read" },
  { id: "payroll", label: "Bảng công & lương", permission: "payroll:read" },
  {
    id: "integration",
    label: "Tích hợp & KPI",
    permission: "integration:read",
  },
];

export function ConfigurationTabs({
  tabsToShow = ["policy", "schedule", "payroll", "integration"],
}: {
  tabsToShow?: Tab[];
}) {
  const [tab, setTab] = useState<Tab>("policy");
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const visibleTabs = tabs.filter(
    (item) => tabsToShow.includes(item.id) && hasPermission(item.permission),
  );
  const selectedTab = visibleTabs.some((item) => item.id === tab)
    ? tab
    : visibleTabs[0]?.id;

  useEffect(() => {
    if (selectedTab && selectedTab !== tab) setTab(selectedTab);
  }, [selectedTab, tab]);

  if (!visibleTabs.length) return null;

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
      <h2 className="mb-4 font-semibold text-ink">
        {visibleTabs.length === 1 ? visibleTabs[0].label : "Chấm công & ca làm"}
      </h2>
      {visibleTabs.length > 1 && (
        <div
          className="mb-5 flex gap-2 overflow-x-auto border-b border-border pb-3"
          role="tablist"
        >
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selectedTab === item.id}
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${selectedTab === item.id ? "bg-ink text-white" : "bg-canvas text-ink-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {selectedTab === "policy" && <PolicyPanel />}
      {selectedTab === "schedule" && <SchedulePanel />}
      {selectedTab === "payroll" && <PayrollPanel />}
      {selectedTab === "integration" && <IntegrationPanel />}
    </section>
  );
}

function PolicyPanel() {
  const { data } = useAttendancePolicy();
  const update = useUpdateAttendancePolicy();
  const canUpdate = useAuthStore((state) =>
    state.hasPermission("attendance-policy:update"),
  );
  const [form, setForm] = useState<AttendancePolicy>({
    requireGps: true,
    livenessMode: "RANDOM",
    faceDuplicateThreshold: 0.43,
    auditRetentionDays: 90,
    rosterAutoGenerateEnabled: true,
    rosterGenerationDay: 20,
  });
  useEffect(() => {
    if (data) setForm({ ...data, requireGps: true });
  }, [data]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canUpdate) return;
        update.mutate({
          livenessMode: form.livenessMode,
          faceDuplicateThreshold: form.faceDuplicateThreshold,
          auditRetentionDays: form.auditRetentionDays,
          rosterAutoGenerateEnabled: form.rosterAutoGenerateEnabled,
          rosterGenerationDay: form.rosterGenerationDay,
        });
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Chống gian lận</span>
        <Select
          value={form.livenessMode}
          onChange={(e) =>
            setForm({
              ...form,
              livenessMode: e.target.value as AttendancePolicy["livenessMode"],
            })
          }
        >
          <option value="RANDOM">Ngẫu nhiên (mỗi lần một yêu cầu)</option>
          <option value="BLINK">Nháy mắt</option>
          <option value="TURN_HEAD">Quay đầu trái / phải</option>
          <option value="SMILE">Mỉm cười</option>
        </Select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Sinh lịch tháng kế tiếp</span>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.rosterAutoGenerateEnabled}
            onChange={(e) => setForm({ ...form, rosterAutoGenerateEnabled: e.target.checked })}
            disabled={!canUpdate}
          />
          <span className="text-sm text-ink-muted">Tự động vào ngày</span>
          <Input
            type="number"
            min={1}
            max={28}
            className="w-20"
            value={form.rosterGenerationDay}
            onChange={(e) => setForm({ ...form, rosterGenerationDay: Number(e.target.value) })}
            disabled={!canUpdate || !form.rosterAutoGenerateEnabled}
          />
          <span className="text-sm text-ink-muted">hàng tháng</span>
        </div>
      </label>
      
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Độ nhạy phát hiện trùng khuôn mặt
        </span>
        <Input
          type="number"
          min={0.35}
          max={0.65}
          step={0.01}
          value={form.faceDuplicateThreshold}
          onChange={(e) =>
            setForm({ ...form, faceDuplicateThreshold: Number(e.target.value) })
          }
        />
        <span className="block text-xs text-ink-muted">
          Giá trị thấp hơn sẽ ít báo nhầm hai người khác nhau là cùng một người.
          Khuyến nghị 0.43.
        </span>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Lưu ảnh audit (ngày)
        </span>
        <Input
          type="number"
          min={1}
          max={3650}
          value={form.auditRetentionDays}
          onChange={(e) =>
            setForm({ ...form, auditRetentionDays: Number(e.target.value) })
          }
        />
      </label>
      <PanelFooter
        pending={update.isPending}
        error={update.isError}
        success={update.isSuccess}
        disabled={!canUpdate}
        permissionMessage={
          canUpdate
            ? undefined
            : "Tài khoản chưa có quyền sửa chính sách chấm công. Hãy cấp quyền attendance-policy:update trong Vai trò & quyền."
        }
        errorMessage={
          update.isError
            ? (() => {
                const message = (
                  update.error as {
                    response?: { data?: { message?: string | string[] } };
                  }
                )?.response?.data?.message;
                return Array.isArray(message) ? message.join(", ") : message;
              })()
            : undefined
        }
      />
    </form>
  );
}

function KpiFieldsPanel() {
  const { data: fields } = useIntegrationKpiFields();
  const create = useCreateIntegrationKpiField();
  const remove = useDeleteIntegrationKpiField();
  const [form, setForm] = useState<
    Omit<IntegrationKpiField, "id" | "isActive">
  >({ key: "", label: "", fieldType: "NUMBER", required: false, sortOrder: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const reset = () => setForm({ key: "", label: "", fieldType: "NUMBER", required: false, sortOrder: 0 });
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-ink">Chỉ số KPI linh động</h3>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}><Plus /> Thêm trường</Button>
      </div>
      <div className="space-y-2">
        {fields?.map((field) => (
          <div
            key={field.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm"
          >
            <span>
              <b>{field.label}</b>{" "}
              <span className="text-ink-muted">
                ({field.key} · {field.fieldType}
                {field.required ? " · bắt buộc" : ""})
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate(field.id)}
            >
              <Trash2 /> Xóa
            </Button>
          </div>
        )) ?? <p className="text-sm text-ink-muted">Đang tải trường KPI…</p>}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="p-5 sm:p-6">
          <DialogTitle>Thêm trường KPI</DialogTitle>
          <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            create.mutate(form, { onSuccess: () => { reset(); setCreateOpen(false); } });
          }}>
        <Input
          required
          placeholder="Mã, ví dụ sales_target"
          value={form.key}
          onChange={(e) =>
            setForm({
              ...form,
              key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            })
          }
        />
        <Input
          required
          placeholder="Nhãn, ví dụ Doanh số mục tiêu"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <Select
          value={form.fieldType}
          onChange={(e) =>
            setForm({
              ...form,
              fieldType: e.target.value as IntegrationKpiField["fieldType"],
            })
          }
        >
          <option value="NUMBER">Số</option>
          <option value="TEXT">Văn bản</option>
          <option value="BOOLEAN">Đúng/Sai</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm({ ...form, required: e.target.checked })}
          />{" "}
          Bắt buộc
        </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={create.isPending}>Hủy</Button>
              <Button type="submit" disabled={create.isPending || !form.key || !form.label}>{create.isPending ? "Đang lưu…" : "Thêm trường"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SchedulePanel() {
  const { data: schedules } = useWorkSchedules();
  const create = useCreateWorkSchedule();
  const update = useUpdateWorkSchedule();
  const remove = useDeleteWorkSchedule();
  const reorder = useReorderWorkSchedules();
  const [form, setForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    secondStartTime: "",
    secondEndTime: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const reorderSchedules = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !schedules) return;
    const from = schedules.findIndex((schedule) => schedule.id === active.id);
    const to = schedules.findIndex((schedule) => schedule.id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate(arrayMove(schedules, from, to).map((schedule) => schedule.id));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        ...form,
        secondStartTime: form.secondStartTime || undefined,
        secondEndTime: form.secondEndTime || undefined,
      },
      {
        onSuccess: () => {
          setForm({
            name: "",
            startTime: "08:00",
            endTime: "17:00",
            secondStartTime: "",
            secondEndTime: "",
          });
          setCreateOpen(false);
        },
      },
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}><Plus /> Thêm ca</Button>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl p-5 sm:p-6">
          <DialogTitle>Thêm ca làm</DialogTitle>
          <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
        <Input
          required
          className="sm:col-span-2"
          placeholder="Tên ca, ví dụ Ca sáng"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          required
          type="time"
          aria-label="Bắt đầu ca thứ nhất"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
        />
        <Input
          required
          type="time"
          aria-label="Kết thúc ca thứ nhất"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
        />
        <Input
          type="time"
          aria-label="Bắt đầu ca thứ hai"
          value={form.secondStartTime}
          onChange={(e) =>
            setForm({ ...form, secondStartTime: e.target.value })
          }
        />
        <Input
          type="time"
          aria-label="Kết thúc ca thứ hai"
          value={form.secondEndTime}
          onChange={(e) => setForm({ ...form, secondEndTime: e.target.value })}
        />
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={create.isPending}>Hủy</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Đang lưu…" : "Thêm ca"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderSchedules}>
        <SortableContext items={(schedules ?? []).map((schedule) => schedule.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
        {schedules?.map((schedule, index) =>
          editing === schedule.id ? (
            <ScheduleEditor
              key={schedule.id}
              schedule={schedule}
              pending={update.isPending}
              onSave={(value) =>
                update.mutate(value, { onSuccess: () => setEditing(null) })
              }
              onCancel={() => setEditing(null)}
            />
          ) : (
            <SortableScheduleCard
              key={schedule.id}
              schedule={schedule}
              disabled={reorder.isPending}
              canMoveUp={index > 0}
              canMoveDown={index < schedules.length - 1}
              onMove={(offset) => reorder.mutate(arrayMove(schedules, index, index + offset).map((item) => item.id))}
              onEdit={() => setEditing(schedule.id)}
              onDelete={() => setDeleting(schedule)}
            />
          ),
        ) ?? <p className="text-sm text-ink-muted">Đang tải ca làm…</p>}
          </div>
        </SortableContext>
      </DndContext>
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Xóa ca làm"
        description={`Xóa ca “${deleting?.name ?? ""}”?`}
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

function SortableScheduleCard({ schedule, disabled, canMoveUp, canMoveDown, onMove, onEdit, onDelete }: {
  schedule: WorkSchedule;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: schedule.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm ${isDragging ? "relative z-10 opacity-70 shadow-card-hover" : ""}`}>
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className="touch-none cursor-grab rounded-lg p-1 text-ink-subtle hover:bg-canvas active:cursor-grabbing" aria-label={`Kéo để sắp xếp ca ${schedule.name}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0">
          <span className="font-medium text-ink">{schedule.name}</span>
          <span className="ml-2 text-ink-muted">
            {schedule.startTime} – {schedule.endTime}
            {schedule.secondStartTime && schedule.secondEndTime ? ` · ${schedule.secondStartTime} – ${schedule.secondEndTime}` : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label={`Đưa ca ${schedule.name} lên trên`} disabled={disabled || !canMoveUp} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Đưa ca ${schedule.name} xuống dưới`} disabled={disabled || !canMoveDown} onClick={() => onMove(1)}><ArrowDown /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Sửa ca" onClick={onEdit}><Pencil /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Xóa ca" onClick={onDelete}><Trash2 /></Button>
      </div>
    </div>
  );
}

function ScheduleEditor({
  schedule,
  pending,
  onSave,
  onCancel,
}: {
  schedule: WorkSchedule;
  pending: boolean;
  onSave: (value: WorkSchedule) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(schedule);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...form,
          secondStartTime: form.secondStartTime || null,
          secondEndTime: form.secondEndTime || null,
        });
      }}
      className="grid gap-2 rounded-xl border border-ink bg-canvas p-3 sm:grid-cols-4"
    >
      <Input
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Input
        required
        type="time"
        value={form.startTime}
        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
      />
      <Input
        required
        type="time"
        value={form.endTime}
        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
      />
      <Input
        type="time"
        value={form.secondStartTime ?? ""}
        onChange={(e) =>
          setForm({ ...form, secondStartTime: e.target.value || null })
        }
      />
      <Input
        type="time"
        value={form.secondEndTime ?? ""}
        onChange={(e) =>
          setForm({ ...form, secondEndTime: e.target.value || null })
        }
      />
      <div className="sm:col-span-4 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Lưu
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function PayrollPanel() {
  const { data } = usePayrollSetting();
  const update = useUpdatePayrollSetting();
  const [form, setForm] = useState<PayrollSetting>({
    payrollMode: "MONTHLY",
    workUnitMode: "DAILY",
    payrollCutoffDay: 25,
    timesheetStartDay: 26,
    timesheetEndDay: 25,
    roundingMinutes: 15,
    latePenaltyPerMinute: 0,
    missingPunchPenalty: 0,
    overtimeTriggerMinutes: 15,
    overtimeMultiplier: 1.5,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  const number =
    (key: keyof PayrollSetting) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: Number(e.target.value) });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(form);
      }}
      className="grid gap-4 sm:grid-cols-3"
    >
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Quy đổi công</span>
        <Select
          value={form.workUnitMode}
          onChange={(e) =>
            setForm({
              ...form,
              workUnitMode: e.target.value as PayrollSetting["workUnitMode"],
            })
          }
        >
          <option value="DAILY">Theo ngày</option>
          <option value="HOURLY">Theo giờ</option>
        </Select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Cách tính lương</span>
        <Select
          value={form.payrollMode}
          onChange={(e) =>
            setForm({
              ...form,
              payrollMode: e.target.value as PayrollSetting["payrollMode"],
            })
          }
        >
          <option value="MONTHLY">Theo tháng</option>
          <option value="HOURLY">Theo giờ</option>
          <option value="SHIFT">Theo ca</option>
          <option value="HYBRID">Kết hợp</option>
        </Select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Làm tròn (phút)</span>
        <Select
          value={String(form.roundingMinutes)}
          onChange={(e) =>
            setForm({ ...form, roundingMinutes: Number(e.target.value) })
          }
        >
          {[1, 5, 10, 15, 30, 60].map((value) => (
            <option key={value} value={value}>
              {value} phút
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Ngày bắt đầu kỳ</span>
        <Input
          type="number"
          min={1}
          max={31}
          value={form.timesheetStartDay}
          onChange={number("timesheetStartDay")}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Ngày kết thúc kỳ</span>
        <Input
          type="number"
          min={1}
          max={31}
          value={form.timesheetEndDay}
          onChange={number("timesheetEndDay")}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Ngưỡng tăng ca (phút)
        </span>
        <Input
          type="number"
          min={0}
          max={240}
          value={form.overtimeTriggerMinutes}
          onChange={number("overtimeTriggerMinutes")}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Phạt muộn/phút (VND)
        </span>
        <Input
          type="number"
          min={0}
          value={form.latePenaltyPerMinute}
          onChange={number("latePenaltyPerMinute")}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Phạt quên chấm (VND)
        </span>
        <Input
          type="number"
          min={0}
          value={form.missingPunchPenalty}
          onChange={number("missingPunchPenalty")}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-ink">Hệ số tăng ca</span>
        <Input
          type="number"
          step="0.1"
          min={1}
          max={10}
          value={form.overtimeMultiplier}
          onChange={number("overtimeMultiplier")}
        />
      </label>
      <PanelFooter
        pending={update.isPending}
        error={update.isError}
        success={update.isSuccess}
      />
    </form>
  );
}
function IntegrationPanel() {
  const { data } = useIntegrationSetting();
  const update = useUpdateIntegrationSetting();
  const [form, setForm] = useState<IntegrationSetting>({
    integrationApiEnabled: false,
    integrationAllowedOrigins: [],
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(form);
      }}
      className="space-y-4"
    >
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={form.integrationApiEnabled}
          onChange={(e) =>
            setForm({ ...form, integrationApiEnabled: e.target.checked })
          }
        />{" "}
        Bật API tích hợp
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Domain POS được phép
        </span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
          placeholder="https://pos.example.vn"
          value={form.integrationAllowedOrigins.join("\n")}
          onChange={(e) =>
            setForm({
              ...form,
              integrationAllowedOrigins: e.target.value
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <KpiFieldsPanel />
      <PanelFooter
        pending={update.isPending}
        error={update.isError}
        success={update.isSuccess}
      />
    </form>
  );
}
function PanelFooter({
  pending,
  error,
  success,
  disabled = false,
  errorMessage,
  permissionMessage,
}: {
  pending: boolean;
  error: boolean;
  success: boolean;
  disabled?: boolean;
  errorMessage?: string;
  permissionMessage?: string;
}) {
  return (
    <div className="sm:col-span-3 flex items-center gap-3">
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Đang lưu…" : "Lưu"}
      </Button>
      {error && (
        <span className="text-sm text-red-600">
          {errorMessage ?? "Không thể lưu cấu hình."}
        </span>
      )}
      {permissionMessage && (
        <span className="text-sm text-amber-700">{permissionMessage}</span>
      )}
      {success && (
        <span className="text-sm text-emerald-700">Đã lưu và ghi audit.</span>
      )}
    </div>
  );
}
