"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Fingerprint, Pencil, Trash2, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useEmployees } from "@/features/employees/api";
import { useBranches } from "@/features/settings/api";
import {
  useAttendanceHistory,
  useAttendanceList,
  useAttendanceDetail,
  useAttendanceApprovalHistory,
  useCreateAttendanceApprovalRequest,
  useEligibleLocations,
  useManualAttendanceWorkSchedules,
  useMyAttendanceSummary,
  useReviewAttendanceApproval,
  useDeleteAttendanceApprovalRequest,
  useUpdateAttendanceAdjustment,
  useUpdateAttendanceSession,
  useDeleteAttendanceSession,
  useCreateAttendanceSession,
  type AttendanceRecord,
} from "@/features/attendance/api";

const ScannerLoading = () => (
  <div
    className="flex min-h-44 items-center justify-center text-sm text-ink-muted"
    role="status"
    aria-live="polite"
  >
    Đang tải bộ quét camera…
  </div>
);

const CheckScanner = dynamic(
  () => import("@/features/attendance/check-scanner").then((module) => module.CheckScanner),
  { ssr: false, loading: ScannerLoading },
);
const EnrollScanner = dynamic(
  () => import("@/features/attendance/enroll-scanner").then((module) => module.EnrollScanner),
  { ssr: false, loading: ScannerLoading },
);

function timeOf(v?: string | null) {
  return v
    ? new Date(v).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
}

function dateOf(v: string) {
  return new Date(v).toLocaleDateString("vi-VN");
}

function inputTimeOf(v?: string | null) {
  return v
    ? new Date(v).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";
}

function ApprovalStatus({
  status,
}: {
  status: AttendanceRecord["approvalDisplayStatus"];
}) {
  if (!status) return <span className="text-ink-subtle">—</span>;
  return <StatusBadge status={status} />;
}

function sessionTime(
  record: AttendanceRecord,
  sequence: number,
  kind: "in" | "out",
) {
  const session = record.sessions?.find((item) => item.sequence === sequence);
  return timeOf(kind === "in" ? session?.checkInAt : session?.checkOutAt);
}

function duration(minutes?: number) {
  if (minutes == null) return "—";
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(minutes / 60)}`;
}

function timeInputOf(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "";
}

function attendanceDateTimeToIso(workDate: string, time: string) {
  const [year, month, day] = workDate.slice(0, 10).split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(desiredUtc));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const representedUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return new Date(desiredUtc - (representedUtc - desiredUtc)).toISOString();
}

function formatMoney(value?: number | null) {
  return formatCurrency(value ?? 0);
}

function moneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
        Number(digits),
      )
    : "";
}

function moneyValue(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

function dateTimeOf(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

function AuditThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  if (!src) return <span className="text-ink-subtle">—</span>;
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="relative block w-fit"
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
      onMouseMove={(event) => setCursor({ x: event.clientX, y: event.clientY })}
      title="Rê chuột để phóng to · bấm để mở ảnh"
    >
      <Image
        src={src}
        alt={alt}
        width={44}
        height={44}
        sizes="44px"
        className="size-11 rounded-lg border border-border object-cover"
      />
      {showPreview && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[100] w-72 rounded-2xl border border-border bg-card p-2 shadow-card-hover"
              style={{
                left: Math.min(cursor.x + 16, window.innerWidth - 304),
                top: Math.min(cursor.y + 16, window.innerHeight - 250),
              }}
            >
              <Image
                src={src}
                alt={alt}
                width={288}
                height={216}
                sizes="288px"
                className="max-h-56 w-full rounded-xl object-contain"
              />
            </span>,
            document.body,
          )
        : null}
    </a>
  );
}

const RECORD_COLUMNS: ColumnDef<AttendanceRecord>[] = [
  {
    id: "workDate",
    header: "Ngày",
    size: 95,
    cell: ({ row }) => dateOf(row.original.workDate),
  },
  {
    accessorKey: "employee",
    header: "Nhân viên",
    size: 120,
    cell: ({ row }) => (
      <div>
        <button
          type="button"
          className="font-medium hover:text-accent-purple hover:underline"
          title="Xem chi tiết ngày chấm"
        >
          {row.original.employee.fullName}
        </button>
        <div className="text-xs text-ink-subtle">
          {row.original.employee.employeeNo}
        </div>
      </div>
    ),
  },
  {
    id: "in1",
    header: "In 1",
    size: 72,
    cell: ({ row }) => sessionTime(row.original, 1, "in"),
  },
  {
    id: "out1",
    header: "Out 1",
    size: 72,
    cell: ({ row }) => sessionTime(row.original, 1, "out"),
  },
  {
    id: "in2",
    header: "In 2",
    size: 72,
    cell: ({ row }) => sessionTime(row.original, 2, "in"),
  },
  {
    id: "out2",
    header: "Out 2",
    size: 72,
    cell: ({ row }) => sessionTime(row.original, 2, "out"),
  },
  {
    id: "checkinPhoto",
    header: "Ảnh Checkin",
    size: 105,
    cell: ({ row }) => (
      <div className="flex gap-1">
        {[1, 2].map((sequence) => (
          <AuditThumbnail
            key={sequence}
            alt={`Ảnh Checkin ca ${sequence}`}
            src={
              row.original.sessions?.find((item) => item.sequence === sequence)
                ?.checkInPhoto
            }
          />
        ))}
      </div>
    ),
  },
  {
    id: "checkoutPhoto",
    header: "Ảnh Checkout",
    size: 105,
    cell: ({ row }) => (
      <div className="flex gap-1">
        {[1, 2].map((sequence) => (
          <AuditThumbnail
            key={sequence}
            alt={`Ảnh Checkout ca ${sequence}`}
            src={
              row.original.sessions?.find((item) => item.sequence === sequence)
                ?.checkOutPhoto
            }
          />
        ))}
      </div>
    ),
  },
  {
    id: "branch",
    header: "Chi nhánh",
    size: 105,
    cell: ({ row }) => row.original.attendanceBranchName ?? "—",
  },
  {
    id: "schedule",
    header: "Ca làm",
    size: 130,
    cell: ({ row }) => (
      <div className="grid gap-1">
        <span>{row.original.workScheduleName ?? "—"}</span>
        {row.original.workScheduleTimes?.length ? (
          <span className="text-xs text-ink-muted">{row.original.workScheduleTimes.join(" · ")}</span>
        ) : null}
        {row.original.exceptionType === "WRONG_SCHEDULE" && (
          <span className="text-xs font-medium text-amber-700">Sai lịch</span>
        )}
      </div>
    ),
  },
  {
    id: "totalHours",
    header: "Tổng giờ",
    size: 70,
    cell: ({ row }) => duration(row.original.totalMinutes),
  },
  {
    id: "lateMinutes",
    header: "Phút muộn",
    size: 70,
    cell: ({ row }) =>
      row.original.lateMinutes == null ? "—" : `${row.original.lateMinutes}p`,
  },
  {
    id: "latePenalty",
    header: "Phạt muộn",
    size: 90,
    cell: ({ row }) =>
      row.original.latePenalty == null
        ? "—"
        : <div className="text-right">{formatCurrency(row.original.latePenalty)}</div>,
  },
  {
    accessorKey: "matchScore",
    header: "Độ khớp",
    size: 70,
    cell: ({ row }) =>
      row.original.matchScore != null
        ? `${Math.round(row.original.matchScore * 100)}%`
        : "—",
  },
  {
    accessorKey: "status",
    header: "Trạng thái",
    size: 90,
    cell: ({ row }) => row.original.status === "NOT_ARRIVED"
      ? <Badge tone="neutral">Chưa đến</Badge>
      : <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "approvalDisplayStatus",
    header: "Phê duyệt",
    size: 90,
    cell: ({ row }) => (
      <ApprovalStatus status={row.original.approvalDisplayStatus} />
    ),
  },
];

type AttendanceSessionTableRow = { id: string; record: AttendanceRecord };

const SESSION_DETAIL_COLUMNS: ColumnDef<AttendanceSessionTableRow>[] = [
  {
    id: "in1",
    header: "In 1",
    cell: ({ row }) => sessionTime(row.original.record, 1, "in"),
  },
  {
    id: "in1Photo",
    header: "Ảnh In 1",
    cell: ({ row }) => (
      <PunchPhotoThumbnail
        label="Ảnh In 1"
        src={row.original.record.sessions?.find((session) => session.sequence === 1)?.checkInPhoto}
      />
    ),
  },
  {
    id: "out1",
    header: "Out 1",
    cell: ({ row }) => sessionTime(row.original.record, 1, "out"),
  },
  {
    id: "out1Photo",
    header: "Ảnh Out 1",
    cell: ({ row }) => (
      <PunchPhotoThumbnail
        label="Ảnh Out 1"
        src={row.original.record.sessions?.find((session) => session.sequence === 1)?.checkOutPhoto}
      />
    ),
  },
  {
    id: "in2",
    header: "In 2",
    cell: ({ row }) => sessionTime(row.original.record, 2, "in"),
  },
  {
    id: "in2Photo",
    header: "Ảnh In 2",
    cell: ({ row }) => (
      <PunchPhotoThumbnail
        label="Ảnh In 2"
        src={row.original.record.sessions?.find((session) => session.sequence === 2)?.checkInPhoto}
      />
    ),
  },
  {
    id: "out2",
    header: "Out 2",
    cell: ({ row }) => sessionTime(row.original.record, 2, "out"),
  },
  {
    id: "out2Photo",
    header: "Ảnh Out 2",
    cell: ({ row }) => (
      <PunchPhotoThumbnail
        label="Ảnh Out 2"
        src={row.original.record.sessions?.find((session) => session.sequence === 2)?.checkOutPhoto}
      />
    ),
  },
];

const APPROVAL_REASON_OPTIONS: Array<{
  value: ApprovalReason;
  label: string;
}> = [
  { value: "WRONG_SCHEDULE", label: "Đổi ca" },
  { value: "GPS_UNAVAILABLE", label: "Lỗi GPS" },
  { value: "FACE_UNRECOGNIZED", label: "Lỗi nhận diện" },
  { value: "MISSED_PUNCH", label: "Quên chấm công" },
  { value: "LATE_ARRIVAL", label: "Xin đi muộn" },
  { value: "OVERTIME", label: "Làm thêm giờ" },
  { value: "OTHER", label: "Lý do khác" },
];

/** Attendance capture is always scoped to the logged-in account. */
function PunchCameraDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const employeeId = useAuthStore((state) => state.user?.employeeId);
  const { data: summary } = useMyAttendanceSummary();
  const latest = summary?.today?.sessions.at(-1);
  const kind = !latest || latest.checkOutAt ? "check-in" : "check-out";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/2 max-h-[92vh] max-w-xl -translate-y-1/2 overflow-y-auto p-5">
        <DialogTitle>Chấm công cá nhân</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">
          Camera chỉ ghi nhận lượt chấm cho tài khoản đang đăng nhập.
        </DialogDescription>
        {employeeId ? (
          <div className="mt-4">
            <CheckScanner
              key={`${employeeId}-${kind}`}
              kind={kind}
              approvalEmployeeId={employeeId}
              onPunchCompleted={() => onOpenChange(false)}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Tài khoản này chưa được liên kết với hồ sơ nhân viên.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ApprovalReason =
  | NonNullable<AttendanceRecord["exceptionType"]>
  | "OVERTIME";

function PersonalApprovalDialog({
  record,
  onOpenChange,
  embedded = false,
}: {
  record: AttendanceRecord | null;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
}) {
  const employeeId = useAuthStore((state) => state.user?.employeeId);
  const requestApproval = useCreateAttendanceApprovalRequest();
  const { data: locations } = useEligibleLocations(employeeId ?? "");
  const { data: workSchedules } = useManualAttendanceWorkSchedules(
    Boolean(employeeId),
  );
  const { data: branches } = useBranches(Boolean(employeeId));
  const [reasons, setReasons] = useState<ApprovalReason[]>([]);
  const [note, setNote] = useState("");
  const [branchLocationId, setBranchLocationId] = useState("");
  const [workScheduleId, setWorkScheduleId] = useState("");
  const [workScheduleBranchIds, setWorkScheduleBranchIds] = useState<string[]>([]);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [checkIn2Time, setCheckIn2Time] = useState("");
  const [checkOut2Time, setCheckOut2Time] = useState("");
  const [overtimeMinutes, setOvertimeMinutes] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const savedEvidenceCount = record?.approvalEvidencePhotos?.length ?? 0;
  const assignedSchedule = useMemo(
    () =>
      workSchedules?.find(
        (schedule) =>
          schedule.name ===
          (record?.manualWorkScheduleName ?? record?.workScheduleName),
      ),
    [record?.manualWorkScheduleName, record?.workScheduleName, workSchedules],
  );

  useEffect(() => {
    if (!reasons.includes("MISSED_PUNCH") || !record) return;
    setCheckInTime(
      (current) =>
        current ||
        inputTimeOf(record.checkInAt) ||
        assignedSchedule?.startTime ||
        "",
    );
    setCheckOutTime(
      (current) =>
        current ||
        inputTimeOf(record.checkOutAt) ||
        assignedSchedule?.endTime ||
        "",
    );
    setCheckIn2Time(
      (current) =>
        current ||
        inputTimeOf(
          record.sessions?.find((session) => session.sequence === 2)?.checkInAt,
        ) ||
        assignedSchedule?.secondStartTime ||
        "",
    );
    setCheckOut2Time(
      (current) =>
        current ||
        inputTimeOf(
          record.sessions?.find((session) => session.sequence === 2)
            ?.checkOutAt,
        ) ||
        assignedSchedule?.secondEndTime ||
        "",
    );
  }, [assignedSchedule?.endTime, assignedSchedule?.secondEndTime, assignedSchedule?.secondStartTime, assignedSchedule?.startTime, reasons, record]);

  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);
  useEffect(() => {
    const currentRecord = recordRef.current;
    if (!currentRecord) return;
    setReasons(
      currentRecord.approvalReasons?.length
        ? currentRecord.approvalReasons
        : currentRecord.exceptionType
          ? [currentRecord.exceptionType]
          : [],
    );
    setNote(currentRecord.approvalRequestNote ?? "");
    const requested = currentRecord.approvalItems ?? [];
    const missedPunch = requested.find((item) => item.type === "MISSED_PUNCH");
    const wrongSchedule = requested.find(
      (item) => item.type === "WRONG_SCHEDULE",
    );
    const gps = requested.find((item) => item.type === "GPS_UNAVAILABLE");
    const overtime = requested.find((item) => item.type === "OVERTIME");
    setCheckInTime(inputTimeOf(missedPunch?.proposedCheckIn));
    setCheckOutTime(inputTimeOf(missedPunch?.proposedCheckOut));
    setCheckIn2Time(inputTimeOf(missedPunch?.proposedCheckIn2));
    setCheckOut2Time(inputTimeOf(missedPunch?.proposedCheckOut2));
    setWorkScheduleId(wrongSchedule?.workScheduleId ?? "");
    setWorkScheduleBranchIds(wrongSchedule?.workScheduleBranchIds ?? []);
    setBranchLocationId(gps?.branchLocationId ?? "");
    setOvertimeMinutes(overtime?.overtimeMinutes?.toString() ?? "");
    setEvidencePhotos([]);
  }, [record?.id]);

  const toggleReason = (value: ApprovalReason) => {
    setReasons((current) =>
      current.includes(value)
        ? current.filter((reason) => reason !== value)
        : [...current, value],
    );
  };

  const addEvidence = (files: FileList | null) => {
    const images = Array.from(files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 5 - savedEvidenceCount - evidencePhotos.length);
    void Promise.all(
      images.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((photos) =>
      setEvidencePhotos((current) =>
        [...current, ...photos].slice(0, 5 - savedEvidenceCount),
      ),
    );
  };
  const submit = () => {
    if (!record || !employeeId || !reasons.length) return;
    if (note.trim().length < 5) return;
    const workDate = record.workDate.slice(0, 10);
    const isoTime = (time: string) =>
      new Date(`${workDate}T${time}:00+07:00`).toISOString();
    requestApproval.mutate(
      {
        employeeId,
        attendanceId: record.id,
        action: "REVIEW",
        exceptionType:
          reasons.find((reason) => reason !== "OVERTIME") ?? "OTHER",
        exceptionTypes: reasons,
        note: note.trim(),
        ...(evidencePhotos.length ? { evidencePhotos } : {}),
        ...(reasons.includes("FACE_UNRECOGNIZED")
          ? { targetEmployeeId: employeeId }
          : {}),
        ...(reasons.includes("GPS_UNAVAILABLE") && branchLocationId
          ? { branchLocationId, appliesTo: "CHECK_IN" as const }
          : {}),
        ...(reasons.includes("WRONG_SCHEDULE") && workScheduleId
          ? { workScheduleId, workScheduleBranchIds }
          : {}),
        ...(reasons.includes("MISSED_PUNCH") && checkInTime
          ? { proposedCheckIn: isoTime(checkInTime) }
          : {}),
        ...(reasons.includes("MISSED_PUNCH") && checkOutTime
          ? { proposedCheckOut: isoTime(checkOutTime) }
          : {}),
        ...(reasons.includes("MISSED_PUNCH") && checkIn2Time
          ? { proposedCheckIn2: isoTime(checkIn2Time) }
          : {}),
        ...(reasons.includes("MISSED_PUNCH") && checkOut2Time
          ? { proposedCheckOut2: isoTime(checkOut2Time) }
          : {}),
        ...(reasons.includes("OVERTIME")
          ? { overtimeMinutes: Number(overtimeMinutes) }
          : {}),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const form = (
    <div className={embedded ? "mt-5 space-y-4" : "mt-5 space-y-4"}>
      <fieldset>
        <legend className="text-sm font-medium">
          Lý do (có thể chọn nhiều)
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {APPROVAL_REASON_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={reasons.includes(option.value)}
                onChange={() => toggleReason(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {reasons.includes("FACE_UNRECOGNIZED") ? (
        <p className="rounded-lg bg-canvas p-3 text-sm text-ink-muted">
          Yêu cầu sẽ gắn lại lượt chấm cho chính tài khoản của bạn.
        </p>
      ) : null}
      {reasons.includes("GPS_UNAVAILABLE") ? (
        <label className="block">
          <span className="text-sm font-medium">Chi nhánh / điểm chấm</span>
          <Select
            value={branchLocationId}
            onChange={(event) => setBranchLocationId(event.target.value)}
          >
            <option value="">Chọn điểm chấm công</option>
            {locations?.map((location) => (
              <option key={location.id} value={location.id}>
                {location.branchName} · {location.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      {reasons.includes("WRONG_SCHEDULE") ? (
        <label className="block">
          <span className="text-sm font-medium">Ca làm thay thế</span>
          <Select
            value={workScheduleId}
            onChange={(event) => setWorkScheduleId(event.target.value)}
          >
            <option value="">Chọn ca cần đổi sang</option>
            {workSchedules?.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name} · {schedule.startTime}–{schedule.endTime}
              </option>
            ))}
          </Select>
          <span className="mt-1 block text-xs text-ink-muted">
            Khi duyệt, ca này sẽ được áp vào lượt chấm của ngày hiện tại.
          </span>
          {(workSchedules?.find((schedule) => schedule.id === workScheduleId)?.secondStartTime ? [0, 1] : [0]).map((index) => (
            <Select key={index} value={workScheduleBranchIds[index] ?? branches?.[0]?.id ?? ""} onChange={(event) => setWorkScheduleBranchIds((current) => { const next = [...current]; next[index] = event.target.value; return next; })}>
              <option value="">Chọn cửa hàng khung {index + 1}</option>
              {branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          ))}
        </label>
      ) : null}
      {reasons.includes("MISSED_PUNCH") ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Giờ cần bổ sung</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label>
              <span className="text-xs text-ink-muted">In 1</span>
              <Input
                type="time"
                value={checkInTime}
                onChange={(event) => setCheckInTime(event.target.value)}
              />
            </label>
            <label>
              <span className="text-xs text-ink-muted">Out 1</span>
              <Input
                type="time"
                value={checkOutTime}
                onChange={(event) => setCheckOutTime(event.target.value)}
              />
            </label>
            <label>
              <span className="text-xs text-ink-muted">In 2</span>
              <Input
                type="time"
                value={checkIn2Time}
                onChange={(event) => setCheckIn2Time(event.target.value)}
              />
            </label>
            <label>
              <span className="text-xs text-ink-muted">Out 2</span>
              <Input
                type="time"
                value={checkOut2Time}
                onChange={(event) => setCheckOut2Time(event.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-ink-muted">
            Ca thường chỉ dùng In 1/Out 1; ca gãy có thể bổ sung In 2/Out 2.
          </p>
        </div>
      ) : null}
      {reasons.includes("OVERTIME") ? (
        <label className="block">
          <span className="text-sm font-medium">Số phút xin làm thêm</span>
          <Input
            type="number"
            min="1"
            max="1440"
            value={overtimeMinutes}
            onChange={(event) => setOvertimeMinutes(event.target.value)}
            placeholder="Ví dụ: 90"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Chỉ cộng số phút được quản lý duyệt vào công.
          </span>
        </label>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium">Nội dung</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          minLength={5}
          maxLength={1000}
          className="mt-1 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <div>
        <span className="text-sm font-medium">
          Ảnh chứng minh (tùy chọn, tối đa 5 ảnh)
        </span>
        <label className="mt-1 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border px-3 py-4 text-sm text-ink-muted">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(event) => addEvidence(event.target.files)}
          />
          Tải lên / chụp ảnh chứng minh
        </label>
        {evidencePhotos.length ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {evidencePhotos.map((photo, index) => (
              <div className="relative" key={`${photo.slice(-12)}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`Ảnh chứng minh ${index + 1}`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-ink/70 px-1.5 text-white"
                  onClick={() =>
                    setEvidencePhotos((photos) =>
                      photos.filter((_, item) => item !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            Có thể bổ sung khi quản lý yêu cầu.
            {savedEvidenceCount ? ` Đã có ${savedEvidenceCount} ảnh.` : ""}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
        >
          Hủy
        </Button>
        <Button
          type="button"
          disabled={
            requestApproval.isPending ||
            !reasons.length ||
            note.trim().length < 5 ||
            (reasons.includes("OVERTIME") &&
              (!record?.checkOutAt || Number(overtimeMinutes) < 1)) ||
            (reasons.includes("GPS_UNAVAILABLE") && !branchLocationId) ||
            (reasons.includes("WRONG_SCHEDULE") && !workScheduleId) ||
            (reasons.includes("MISSED_PUNCH") &&
              !checkInTime &&
              !checkOutTime &&
              !checkIn2Time &&
              !checkOut2Time)
          }
          onClick={submit}
        >
          {requestApproval.isPending
            ? "Đang lưu…"
            : record?.approvalStatus === "PENDING"
              ? "Cập nhật"
              : "Xin duyệt"}
        </Button>
      </div>
    </div>
  );
  if (embedded) return form;
  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/2 max-h-[90vh] max-w-lg -translate-y-1/2 overflow-y-auto p-6">
        <DialogTitle className="text-xl font-bold">
          Xin duyệt chấm công
        </DialogTitle>
        <DialogDescription className="mt-1">
          Yêu cầu áp dụng cho ngày{" "}
          {record ? new Date(record.workDate).toLocaleDateString("vi-VN") : ""}.
        </DialogDescription>
        {form}
      </DialogContent>
    </Dialog>
  );
}

function PunchPhotoThumbnail({
  src,
  label,
}: {
  src?: string | null;
  label: string;
}) {
  if (!src) return <span className="text-ink-subtle">—</span>;
  return (
    <span className="group relative inline-flex">
      {/* Presigned audit image URLs cannot use the static Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="size-8 rounded-md border border-border object-cover"
      />
      <span className="pointer-events-none absolute left-0 top-10 z-50 hidden w-48 rounded-lg border border-border bg-card p-1 shadow-xl group-hover:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="aspect-[3/4] w-full rounded-md object-cover"
        />
      </span>
    </span>
  );
}

function ConfirmDeleteDialog({
  open,
  title,
  description,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        <DialogDescription className="mt-2">{description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Đang xóa…" : "Xóa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalRequestHistory({ attendanceId }: { attendanceId: string }) {
  const { data: history } = useAttendanceApprovalHistory(attendanceId);
  if (!history?.length) return null;
  const label = (action: string) =>
    ({
      CREATE: "Gửi phiếu",
      UPDATE: "Cập nhật / yêu cầu bổ sung",
      APPROVE: "Duyệt",
      REJECT: "Từ chối",
      DELETE: "Xóa phiếu",
    })[action] ?? action;
  return (
    <section className="border-t border-border pt-4">
      <h3 className="font-bold text-ink">Lịch sử xin duyệt</h3>
      <ol className="mt-2 space-y-2 border-l border-border pl-3 text-sm text-ink-muted">
        {history.map((entry) => (
          <li key={entry.id}>
            <span className="font-semibold text-ink">
              {label(entry.action)}
            </span>
            {entry.actor?.fullName
              ? ` · ${entry.actor.fullName}`
              : " · Hệ thống"}
            <span> · {dateTimeOf(entry.createdAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AttendanceDayDialog({
  record: incomingRecord,
  onOpenChange,
  reviewMode = false,
  allowApprovalRequest = false,
  manageMode = false,
}: {
  record: AttendanceRecord | null;
  onOpenChange: (open: boolean) => void;
  reviewMode?: boolean;
  allowApprovalRequest?: boolean;
  manageMode?: boolean;
}) {
  const [record, setRecord] = useState<AttendanceRecord | null>(incomingRecord);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const updateAdjustment = useUpdateAttendanceAdjustment();
  const updateSession = useUpdateAttendanceSession();
  const deleteSession = useDeleteAttendanceSession();
  const createSession = useCreateAttendanceSession();
  const { data: schedules } = useManualAttendanceWorkSchedules(manageMode);
  const [editingRecord, setEditingRecord] = useState(false);
  const [scheduleId, setScheduleId] = useState("");
  const [manualScheduleTimes, setManualScheduleTimes] = useState({
    startTime: "",
    endTime: "",
    secondStartTime: "",
    secondEndTime: "",
  });
  const [latePenalty, setLatePenalty] = useState("");
  const [reward, setReward] = useState("");
  const [sessionEdits, setSessionEdits] = useState<
    Record<string, { checkInAt?: string; checkOutAt?: string }>
  >({});
  const [newSession, setNewSession] = useState<{
    checkInAt: string;
    checkOutAt: string;
  } | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  useEffect(() => {
    setRecord(incomingRecord);
    setEditingRecord(false);
    setSessionEdits({});
    setNewSession(null);
    setScheduleId("");
    setManualScheduleTimes(incomingRecord?.manualScheduleTimes ?? {
      startTime: "",
      endTime: "",
      secondStartTime: "",
      secondEndTime: "",
    });
  }, [incomingRecord]);
  const cancelEdit = () => {
    setEditingRecord(false);
    setScheduleId("");
    setLatePenalty("");
    setReward("");
    setSessionEdits({});
    setNewSession(null);
    setManualScheduleTimes({
      startTime: "",
      endTime: "",
      secondStartTime: "",
      secondEndTime: "",
    });
  };
  const saveRecord = () => {
    if (!record) return;
    if (
      scheduleId === "MANUAL" &&
      Object.values(manualScheduleTimes).some((value) => !value)
    ) return;
    if (scheduleId || latePenalty || reward)
      updateAdjustment.mutate(
        {
          id: record.id,
          ...(scheduleId === "MANUAL"
            ? { manualScheduleTimes }
            : scheduleId
              ? { workScheduleId: scheduleId }
              : {}),
          ...(latePenalty ? { latePenalty: moneyValue(latePenalty) } : {}),
          ...(reward ? { reward: moneyValue(reward) } : {}),
        },
        {
          onSuccess: (updated) =>
            setRecord((current) =>
              current ? { ...current, ...updated } : current,
            ),
        },
      );
    Object.entries(sessionEdits).forEach(([sessionId, edit]) =>
      updateSession.mutate(
        {
          attendanceId: record.id,
          sessionId,
          ...(edit.checkInAt
            ? { checkInAt: attendanceDateTimeToIso(record.workDate, edit.checkInAt) }
            : {}),
          ...(edit.checkOutAt
            ? { checkOutAt: attendanceDateTimeToIso(record.workDate, edit.checkOutAt) }
            : {}),
        },
        {
          onSuccess: (updated) =>
            setRecord((current) =>
              current
                ? {
                    ...current,
                    sessions: current.sessions?.map((session) =>
                      session.id === sessionId
                        ? { ...session, ...updated }
                        : session,
                    ),
                  }
                : current,
            ),
        },
      ),
    );
    if (newSession?.checkInAt)
      createSession.mutate(
        {
          attendanceId: record.id,
          checkInAt: attendanceDateTimeToIso(record.workDate, newSession.checkInAt),
          ...(newSession.checkOutAt
            ? { checkOutAt: attendanceDateTimeToIso(record.workDate, newSession.checkOutAt) }
            : {}),
        },
        {
          onSuccess: (created) =>
            setRecord((current) =>
              current
                ? {
                    ...current,
                    sessions: [...(current.sessions ?? []), created],
                  }
                : current,
            ),
        },
      );
    cancelEdit();
  };
  if (manageMode && record)
    return (
      <>
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && editingRecord) return;
            onOpenChange(open);
          }}
        >
          <DialogContent className="top-1/2 max-h-[90vh] max-w-4xl -translate-y-1/2 overflow-y-auto p-6">
            <DialogTitle className="text-xl font-bold">
              Chỉnh sửa chấm công ngày {dateOf(record.workDate)}
            </DialogTitle>
            <div className="mt-5 space-y-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-canvas/50 p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="font-bold text-ink-muted">Trạng thái</dt>
                  <dd className="mt-1">
                    <StatusBadge status={record.status} />
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Phê duyệt</dt>
                  <dd className="mt-1">
                    <ApprovalStatus status={record.approvalDisplayStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Tổng giờ</dt>
                  <dd className="mt-1 font-medium">
                    {duration(record.totalMinutes)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Chi nhánh</dt>
                  <dd className="mt-1 font-medium">
                    {record.attendanceBranchName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Ca làm</dt>
                  <dd className="mt-1 font-medium">
                    {record.workScheduleName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Đi muộn</dt>
                  <dd className="mt-1 font-medium">
                    {record.lateMinutes ?? 0} phút
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Phạt</dt>
                  <dd className="mt-1 text-right font-medium">
                    {record.latePenalty == null
                      ? "—"
                      : formatMoney(record.latePenalty)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink-muted">Thưởng</dt>
                  <dd className="mt-1 text-right font-medium">
                    {record.manualReward == null
                      ? "—"
                      : formatMoney(record.manualReward)}
                  </dd>
                </div>
              </dl>
              <section className="rounded-xl border border-border bg-canvas/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-ink">
                    Chỉnh sửa bản ghi chấm công
                  </h3>
                  {!editingRecord ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (record.manualScheduleTimes) {
                          setScheduleId("MANUAL");
                          setManualScheduleTimes(record.manualScheduleTimes);
                        }
                        setEditingRecord(true);
                      }}
                    >
                      <Pencil />
                      Sửa
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={cancelEdit}
                    >
                      Hủy
                    </Button>
                  )}
                </div>
                {editingRecord ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm font-medium">
                        Ca làm
                        <Select
                          className="mt-1"
                          value={scheduleId}
                          onChange={(event) =>
                            setScheduleId(event.target.value)
                          }
                        >
                          <option value="">
                            Giữ ca hiện tại ({record.workScheduleName ?? "—"})
                          </option>
                          <option value="MANUAL">Thủ công</option>
                          {schedules?.map((schedule) => (
                            <option key={schedule.id} value={schedule.id}>
                              {schedule.name} · {schedule.startTime}–
                              {schedule.endTime}
                            </option>
                          ))}
                        </Select>
                      </label>
                      {scheduleId === "MANUAL" ? (
                        <div className="grid gap-2 sm:col-span-3 sm:grid-cols-4">
                          {([
                            ["startTime", "Giờ bắt đầu ca 1"],
                            ["endTime", "Giờ kết thúc ca 1"],
                            ["secondStartTime", "Giờ bắt đầu ca 2"],
                            ["secondEndTime", "Giờ kết thúc ca 2"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="text-sm font-medium">
                              {label}
                              <Input
                                className="mt-1"
                                type="time"
                                required
                                value={manualScheduleTimes[key]}
                                onChange={(event) =>
                                  setManualScheduleTimes((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                      <label className="text-sm font-medium">
                        Phạt (đ)
                        <Input
                          className="mt-1 text-right"
                          type="text"
                          inputMode="numeric"
                          placeholder={formatMoney(record.latePenalty)}
                          value={latePenalty}
                          onChange={(event) =>
                            setLatePenalty(moneyInput(event.target.value))
                          }
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Thưởng (đ)
                        <Input
                          className="mt-1 text-right"
                          type="text"
                          inputMode="numeric"
                          placeholder={formatMoney(record.manualReward)}
                          value={reward}
                          onChange={(event) =>
                            setReward(moneyInput(event.target.value))
                          }
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {record.sessions?.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">
                              Ca {session.sequence}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Xóa ca ${session.sequence}`}
                              title={`Xóa ca ${session.sequence}`}
                              onClick={() =>
                                setDeleteSessionId({
                                  id: session.id,
                                  sequence: session.sequence,
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <label className="mt-2 block text-xs text-ink-muted">
                            Giờ vào
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              value={
                                sessionEdits[session.id]?.checkInAt ??
                                timeInputOf(session.checkInAt)
                              }
                              onChange={(event) =>
                                setSessionEdits((current) => ({
                                  ...current,
                                  [session.id]: {
                                    ...current[session.id],
                                    checkInAt: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                          <label className="mt-2 block text-xs text-ink-muted">
                            Giờ ra
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              value={
                                sessionEdits[session.id]?.checkOutAt ??
                                timeInputOf(session.checkOutAt)
                              }
                              onChange={(event) =>
                                setSessionEdits((current) => ({
                                  ...current,
                                  [session.id]: {
                                    ...current[session.id],
                                    checkOutAt: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    {(record.sessions?.length ?? 0) < 2 && !newSession ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setNewSession({ checkInAt: "", checkOutAt: "" })
                        }
                      >
                        Thêm ca {(record.sessions?.length ?? 0) + 1}
                      </Button>
                    ) : null}
                    {newSession ? (
                      <div className="rounded-lg border border-dashed border-accent-purple p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">
                            Ca {(record.sessions?.length ?? 0) + 1}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setNewSession(null)}
                          >
                            Hủy
                          </Button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="text-xs text-ink-muted">
                            Giờ vào
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              value={newSession.checkInAt}
                              onChange={(event) =>
                                setNewSession((current) =>
                                  current
                                    ? {
                                        ...current,
                                        checkInAt: event.target.value,
                                      }
                                    : current,
                                )
                              }
                            />
                          </label>
                          <label className="text-xs text-ink-muted">
                            Giờ ra
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              value={newSession.checkOutAt}
                              onChange={(event) =>
                                setNewSession((current) =>
                                  current
                                    ? {
                                        ...current,
                                        checkOutAt: event.target.value,
                                      }
                                    : current,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={cancelEdit}
                      >
                        Hủy
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          updateAdjustment.isPending ||
                          updateSession.isPending ||
                          createSession.isPending ||
                          (scheduleId === "MANUAL" &&
                            Object.values(manualScheduleTimes).some((value) => !value))
                        }
                        onClick={saveRecord}
                      >
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
              <ApprovalDecisionSummary record={record} />
              {record.approvalRequestNote || record.approvalItems?.length ? (
                <ApprovalRequestHistory attendanceId={record.id} />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        <ConfirmDeleteDialog
          open={Boolean(deleteSessionId)}
          title="Xóa ca chấm công"
          description={`Xóa toàn bộ dữ liệu chấm của ca ${deleteSessionId?.sequence ?? ""}?`}
          pending={deleteSession.isPending}
          onOpenChange={(open) => {
            if (!open) setDeleteSessionId(null);
          }}
          onConfirm={() => {
            if (!deleteSessionId) return;
            const removing = deleteSessionId;
            deleteSession.mutate(
              { attendanceId: record.id, sessionId: removing.id },
              {
                onSuccess: () => {
                  setRecord((current) =>
                    current
                      ? {
                          ...current,
                          sessions: current.sessions?.filter(
                            (session) => session.id !== removing.id,
                          ),
                        }
                      : current,
                  );
                  setSessionEdits((current) => {
                    const next = { ...current };
                    delete next[removing.id];
                    return next;
                  });
                  setDeleteSessionId(null);
                },
              },
            );
          }}
        />
      </>
    );
  return (
    <Dialog
      open={Boolean(record)}
      onOpenChange={(open) => {
        if (!open && editingRecord) return;
        onOpenChange(open);
      }}
    >
      <DialogContent className="top-1/2 max-h-[90vh] max-w-4xl -translate-y-1/2 overflow-y-auto p-6">
        <DialogTitle className="text-xl font-bold">
          {reviewMode ? "Phê duyệt chấm công" : "Chi tiết chấm công"} ngày{" "}
          {record ? dateOf(record.workDate) : ""}
        </DialogTitle>
        {record ? (
          <div className="mt-5 space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-canvas/50 p-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="font-bold text-ink-muted">Trạng thái</dt>
                <dd className="mt-1">
                  <StatusBadge status={record.status} />
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Phê duyệt</dt>
                <dd className="mt-1">
                  <ApprovalStatus status={record.approvalDisplayStatus} />
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Tổng giờ</dt>
                <dd className="mt-1 font-medium">
                  {duration(record.totalMinutes)}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Chi nhánh</dt>
                <dd className="mt-1 font-medium">
                  {record.attendanceBranchName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Ca làm</dt>
                <dd className="mt-1 font-medium">
                  {record.workScheduleName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Đi muộn</dt>
                <dd className="mt-1 font-medium">
                  {record.lateMinutes ?? 0} phút
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Phạt</dt>
                <dd className="mt-1 text-right font-medium">
                  {record.latePenalty == null
                    ? "—"
                    : formatMoney(record.latePenalty)}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-muted">Thưởng</dt>
                <dd className="mt-1 text-right font-medium">
                  {record.manualReward == null
                    ? "—"
                    : formatMoney(record.manualReward)}
                </dd>
              </div>
            </dl>
            <DataTable
              tableId="attendance-session-details"
              columns={SESSION_DETAIL_COLUMNS}
              data={[{ id: record.id, record }]}
              searchable={false}
              pageSize={1}
            />
            {manageMode ? (
              <section className="rounded-xl border border-border bg-canvas/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-ink">
                    Chỉnh sửa bản ghi chấm công
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingRecord((value) => !value)}
                  >
                    <Pencil />
                    {editingRecord ? "Đóng" : "Sửa"}
                  </Button>
                </div>
                {editingRecord ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm font-medium">
                        Ca làm
                        <Select
                          className="mt-1"
                          value={scheduleId}
                          onChange={(event) =>
                            setScheduleId(event.target.value)
                          }
                        >
                          <option value="">
                            Giữ ca hiện tại ({record.workScheduleName ?? "—"})
                          </option>
                          {schedules?.map((schedule) => (
                            <option key={schedule.id} value={schedule.id}>
                              {schedule.name} · {schedule.startTime}–
                              {schedule.endTime}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="text-sm font-medium">
                        Phạt (đ)
                        <Input
                          className="mt-1 text-right"
                          type="text"
                          inputMode="numeric"
                          placeholder={formatMoney(record.latePenalty)}
                          value={latePenalty}
                          onChange={(event) =>
                            setLatePenalty(moneyInput(event.target.value))
                          }
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Thưởng (đ)
                        <Input
                          className="mt-1 text-right"
                          type="text"
                          inputMode="numeric"
                          placeholder={formatMoney(record.manualReward)}
                          value={reward}
                          onChange={(event) =>
                            setReward(moneyInput(event.target.value))
                          }
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {record.sessions?.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">
                              Ca {session.sequence}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Xóa ca ${session.sequence}`}
                              title={`Xóa ca ${session.sequence}`}
                              disabled={deleteSession.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Xóa toàn bộ dữ liệu chấm của ca ${session.sequence}?`,
                                  )
                                )
                                  deleteSession.mutate(
                                    {
                                      attendanceId: record.id,
                                      sessionId: session.id,
                                    },
                                    { onSuccess: () => onOpenChange(false) },
                                  );
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <label className="mt-2 block text-xs text-ink-muted">
                            Giờ vào
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              defaultValue={timeInputOf(session.checkInAt)}
                              onChange={(event) =>
                                setSessionEdits((current) => ({
                                  ...current,
                                  [session.id]: {
                                    ...current[session.id],
                                    checkInAt: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                          <label className="mt-2 block text-xs text-ink-muted">
                            Giờ ra
                            <Input
                              className="mt-1"
                              type="time"
                              step={1}
                              defaultValue={timeInputOf(session.checkOutAt)}
                              onChange={(event) =>
                                setSessionEdits((current) => ({
                                  ...current,
                                  [session.id]: {
                                    ...current[session.id],
                                    checkOutAt: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={
                          updateAdjustment.isPending || updateSession.isPending
                        }
                        onClick={saveRecord}
                      >
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
            {reviewMode && record.approvalStatus === "PENDING" ? (
              <ApprovalItemsReviewer
                record={record}
                onDeleted={() => onOpenChange(false)}
              />
            ) : (
              <ApprovalDecisionSummary record={record} />
            )}
            {allowApprovalRequest &&
            (!record.approvalDisplayStatus ||
              record.approvalStatus === "PENDING") ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRequestingApproval((value) => !value)}
                >
                  {requestingApproval
                    ? "Ẩn biểu mẫu"
                    : record.approvalStatus === "PENDING"
                      ? "Cập nhật"
                      : "Xin duyệt"}
                </Button>
              </div>
            ) : null}
            {requestingApproval ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h3 className="font-bold text-amber-950">
                  {record.approvalStatus === "PENDING"
                    ? "Cập nhật"
                    : "Tạo phiếu xin duyệt"}
                </h3>
                <PersonalApprovalDialog
                  embedded
                  record={record}
                  onOpenChange={(open) => !open && setRequestingApproval(false)}
                />
              </section>
            ) : null}
            {record.approvalRequestNote || record.approvalItems?.length ? (
              <ApprovalRequestHistory attendanceId={record.id} />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function AbsensiPage() {
  const searchParams = useSearchParams();
  return searchParams.get("mode") === "history" ? (
    <CompanyView />
  ) : (
    <PersonalView />
  );
}

const approvalReasonLabel: Record<string, string> = {
  WRONG_SCHEDULE: "Đổi ca / sai ca",
  GPS_UNAVAILABLE: "Lỗi GPS",
  FACE_UNRECOGNIZED: "Lỗi nhận diện",
  MISSED_PUNCH: "Quên chấm công",
  LATE_ARRIVAL: "Xin đi muộn",
  OVERTIME: "Làm thêm giờ",
  OTHER: "Lý do khác",
};

function approvalItemDetail(
  item: NonNullable<AttendanceRecord["approvalItems"]>[number],
) {
  if (item.type === "WRONG_SCHEDULE")
    return item.workScheduleName
      ? `Chuyển sang ca: ${item.workScheduleName}`
      : "Chuyển sang ca đã chọn";
  if (item.type === "MISSED_PUNCH")
    return `In 1: ${dateTimeOf(item.proposedCheckIn)} · Out 1: ${dateTimeOf(item.proposedCheckOut)} · In 2: ${dateTimeOf(item.proposedCheckIn2)} · Out 2: ${dateTimeOf(item.proposedCheckOut2)}`;
  if (item.type === "OVERTIME")
    return `Làm thêm: ${item.overtimeMinutes ?? 0} phút`;
  if (item.type === "GPS_UNAVAILABLE") return "Cập nhật lại điểm chấm đã chọn";
  if (item.type === "FACE_UNRECOGNIZED")
    return "Gắn lại lượt chấm cho tài khoản đã chọn";
  return null;
}

function ApprovalDecisionSummary({ record }: { record: AttendanceRecord }) {
  const items = record.approvalItems ?? [];
  if (!record.approvalRequestNote && !items.length) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
      <h3 className="font-bold text-amber-950">Chi tiết đơn xin duyệt</h3>
      {record.approvalRequestNote ? (
        <p className="mt-1 text-amber-950">
          <span className="font-medium">Giải trình:</span>{" "}
          {record.approvalRequestNote}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.type}
            className={
              item.decision === "REJECTED"
                ? "rounded-lg border border-red-200 bg-red-50 p-3 opacity-80"
                : "rounded-lg border border-amber-100 bg-white/80 p-3"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p
                  className={
                    item.decision === "REJECTED"
                      ? "font-semibold line-through"
                      : "font-semibold"
                  }
                >
                  {approvalReasonLabel[item.type] ?? item.type}
                </p>
                {approvalItemDetail(item) ? (
                  <span className="font-medium text-amber-900">
                    — {approvalItemDetail(item)}
                  </span>
                ) : null}
              </div>
              <StatusBadge status={item.decision} />
            </div>
          </div>
        ))}
      </div>
      {record.approvalReviewNote ? (
        <p className="mt-3 rounded-md bg-card/70 px-2 py-1.5 text-xs text-ink-muted">
          <span className="font-medium">Phản hồi của quản lý:</span>{" "}
          {record.approvalReviewNote}
        </p>
      ) : null}
    </section>
  );
}

function ApprovalItemsReviewer({
  record,
  onDeleted,
}: {
  record: AttendanceRecord;
  onDeleted?: () => void;
}) {
  const review = useReviewAttendanceApproval();
  const deleteApproval = useDeleteAttendanceApprovalRequest();
  const isAdmin = useAuthStore(
    (state) => state.user?.roles.some((role) => role === "admin" || role === "ADMIN") ?? false,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: schedules } = useManualAttendanceWorkSchedules();
  const { data: locations } = useEligibleLocations(record.employee.id);
  const { data: employees } = useEmployees({
    pageSize: 100,
    sortBy: "fullName",
    sortOrder: "asc",
  });
  type ReviewItem = NonNullable<AttendanceRecord["approvalItems"]>[number] & {
    proposedCheckIn?: string;
    proposedCheckOut?: string;
    workScheduleId?: string;
    branchLocationId?: string;
    targetEmployeeId?: string;
  };
  const [items, setItems] = useState<ReviewItem[]>(
    () =>
      record.approvalItems ?? [
        { type: record.exceptionType ?? "OTHER", decision: "PENDING" },
      ],
  );
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const updateItem = (type: string, patch: Partial<ReviewItem>) =>
    setItems((current) =>
      current.map((item) =>
        item.type === type ? { ...item, ...patch } : item,
      ),
    );
  const workDate = record.workDate.slice(0, 10);
  const toWorkDateIso = (value?: string) => {
    if (!value) return undefined;
    const date = value.includes("T")
      ? new Date(value)
      : new Date(`${workDate}T${value}:00+07:00`);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };
  const reasonDetail = (item: ReviewItem) => {
    if (item.type === "WRONG_SCHEDULE")
      return `Đổi từ: ${record.workScheduleName ?? "ca hiện tại"} → ${item.workScheduleName ?? "ca đã chọn"}`;
    return approvalItemDetail(item);
  };
  const saveDecision = (
    decision: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO",
  ) => {
    if (decision === "NEEDS_MORE_INFO") {
      review.mutate({
        id: record.id,
        decision,
        note: reviewNote.trim() || undefined,
      });
      return;
    }
    const allItems = items.map((item) => ({
      ...item,
      decision: (item.decision === "PENDING" ? decision : item.decision) as
        | "APPROVED"
        | "REJECTED",
    })) as Array<ReviewItem & { decision: "APPROVED" | "REJECTED" }>;
    review.mutate({
      id: record.id,
      note: reviewNote.trim() || undefined,
      itemReviews: allItems.map((item) => ({
        ...item,
        proposedCheckIn: toWorkDateIso(item.proposedCheckIn),
        proposedCheckOut: toWorkDateIso(item.proposedCheckOut),
        proposedCheckIn2: toWorkDateIso(item.proposedCheckIn2),
        proposedCheckOut2: toWorkDateIso(item.proposedCheckOut2),
      })),
    });
  };
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-white/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-amber-950">Xử lý phê duyệt</h3>
          <p className="mt-1 rounded-lg bg-amber-100/70 px-3 py-2 text-sm text-amber-950">
            <span className="font-bold">Giải trình của nhân viên:</span>{" "}
            {record.approvalRequestNote || "—"}
          </p>
        </div>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 border border-red-300 bg-card text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label="Xóa phiếu xin duyệt"
            title="Xóa phiếu xin duyệt"
            disabled={deleteApproval.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      {items.map((item) => (
        <div
          key={item.type}
          className={
            item.decision === "REJECTED"
              ? "rounded-lg bg-red-50 p-2 line-through opacity-70"
              : "rounded-lg p-2"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-medium">
                {approvalReasonLabel[item.type] ?? item.type}
              </span>
              {reasonDetail(item) ? (
                <span className="text-sm font-semibold text-amber-900">
                  — {reasonDetail(item)}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Sửa ${approvalReasonLabel[item.type] ?? item.type}`}
                onClick={() =>
                  setEditingItem((current) =>
                    current === item.type ? null : item.type,
                  )
                }
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={item.decision === "APPROVED" ? "primary" : "secondary"}
                onClick={() => updateItem(item.type, { decision: "APPROVED" })}
              >
                ✓
              </Button>
              <Button
                type="button"
                size="sm"
                variant={item.decision === "REJECTED" ? "danger" : "secondary"}
                onClick={() => updateItem(item.type, { decision: "REJECTED" })}
              >
                ✕
              </Button>
            </div>
          </div>
          {editingItem === item.type ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2">
              {item.type === "MISSED_PUNCH" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs text-ink-muted">
                    In 1
                    <Input
                      type="time"
                      value={inputTimeOf(item.proposedCheckIn)}
                      onChange={(event) =>
                        updateItem(item.type, {
                          proposedCheckIn: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Out 1
                    <Input
                      type="time"
                      value={inputTimeOf(item.proposedCheckOut)}
                      onChange={(event) =>
                        updateItem(item.type, {
                          proposedCheckOut: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    In 2
                    <Input
                      type="time"
                      value={inputTimeOf(item.proposedCheckIn2)}
                      onChange={(event) =>
                        updateItem(item.type, {
                          proposedCheckIn2: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Out 2
                    <Input
                      type="time"
                      value={inputTimeOf(item.proposedCheckOut2)}
                      onChange={(event) =>
                        updateItem(item.type, {
                          proposedCheckOut2: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {item.type === "WRONG_SCHEDULE" ? (
                <Select
                  value={item.workScheduleId ?? ""}
                  onChange={(event) => {
                    const schedule = schedules?.find(
                      (entry) => entry.id === event.target.value,
                    );
                    updateItem(item.type, {
                      workScheduleId: event.target.value,
                      workScheduleName: schedule?.name,
                    });
                  }}
                >
                  <option value="">Giữ ca nhân viên đã chọn</option>
                  {schedules?.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name} · {schedule.startTime}–{schedule.endTime}
                    </option>
                  ))}
                </Select>
              ) : null}
              {item.type === "GPS_UNAVAILABLE" ? (
                <Select
                  value={item.branchLocationId ?? ""}
                  onChange={(event) =>
                    updateItem(item.type, {
                      branchLocationId: event.target.value,
                    })
                  }
                >
                  <option value="">Giữ điểm nhân viên đã chọn</option>
                  {locations?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.branchName} · {location.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {item.type === "FACE_UNRECOGNIZED" ? (
                <Select
                  value={item.targetEmployeeId ?? ""}
                  onChange={(event) =>
                    updateItem(item.type, {
                      targetEmployeeId: event.target.value,
                    })
                  }
                >
                  <option value="">Giữ tài khoản nhân viên đã chọn</option>
                  {employees?.items.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} · {employee.employeeNo}
                    </option>
                  ))}
                </Select>
              ) : null}
              {item.type === "OVERTIME" ? (
                <label className="block text-sm font-medium">
                  Phút làm thêm
                  <Input
                    className="mt-1"
                    type="number"
                    min="1"
                    max="1440"
                    value={item.overtimeMinutes ?? ""}
                    onChange={(event) =>
                      updateItem(item.type, {
                        overtimeMinutes:
                          Number(event.target.value) || undefined,
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      <label className="block text-sm font-medium">
        Phản hồi của quản lý (áp dụng chung)
        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          maxLength={1000}
          className="mt-1 min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal"
          placeholder="Nội dung phản hồi chung cho toàn bộ đơn (tùy chọn)"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={review.isPending}
          onClick={() => saveDecision("REJECTED")}
        >
          {review.isPending ? "Đang lưu…" : "Từ chối"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={review.isPending || !reviewNote.trim()}
          onClick={() => saveDecision("NEEDS_MORE_INFO")}
        >
          Cần bổ sung
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={review.isPending}
          onClick={() => saveDecision("APPROVED")}
        >
          Duyệt
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Xóa phiếu xin duyệt"
        description="Xóa phiếu xin duyệt này? Lịch sử chấm công được giữ nguyên."
        pending={deleteApproval.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() =>
          deleteApproval.mutate(record.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              onDeleted?.();
            },
          })
        }
      />
    </div>
  );
}

// ---- Privileged (HR/Admin) company-wide view ----
function CompanyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAttendanceId = searchParams.get("attendanceId") ?? "";
  const requestedReviewMode = searchParams.get("review") === "1";
  const { data: requestedRecord } = useAttendanceDetail(requestedAttendanceId);
  const [filters, setFilters] = useState({
    employeeIds: [] as string[],
    from: "",
    to: "",
    status: "",
  });
  const hasActiveFilters = filters.employeeIds.length > 0 || Boolean(filters.from || filters.to || filters.status);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeFilterOpen, setEmployeeFilterOpen] = useState(false);
  const query = useMemo(
    () => ({
      ...(filters.employeeIds.length
        ? { employeeId: filters.employeeIds.join(",") }
        : {}),
      ...Object.fromEntries(
        Object.entries(filters).filter(([key, value]) => key !== "employeeIds" && Boolean(value)),
      ),
    }),
    [filters],
  );
  const { data: list, isLoading } = useAttendanceHistory(query);
  const { data: employees } = useEmployees({
    pageSize: 100,
    sortBy: "fullName",
    sortOrder: "asc",
  });
  const matchingEmployees = employees?.items.filter((employee) =>
    `${employee.fullName} ${employee.employeeNo}`
      .toLocaleLowerCase("vi-VN")
      .includes(employeeSearch.trim().toLocaleLowerCase("vi-VN")),
  );
  const [dialogRecord, setDialogRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [dialogReviewMode, setDialogReviewMode] = useState(false);
  useEffect(() => {
    if (!requestedRecord) return;
    setDialogRecord(requestedRecord);
    setDialogReviewMode(requestedReviewMode);
  }, [requestedRecord, requestedReviewMode]);
  const closeDialog = (open: boolean) => {
    if (open) return;
    setDialogRecord(null);
    if (requestedAttendanceId)
      router.replace("/dashboard/absensi?mode=history");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sử chấm công" />
      <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="relative min-w-0 space-y-1 lg:min-w-56 lg:flex-1">
            <label htmlFor="attendance-employee-filter" className="sr-only">
              Nhân viên
            </label>
            <Input
              id="attendance-employee-filter"
              aria-label="Employee"
              role="combobox"
              aria-expanded={employeeFilterOpen}
              aria-controls="attendance-employee-options"
              autoComplete="off"
              value={employeeFilterOpen ? employeeSearch : filters.employeeIds.length
                ? `${filters.employeeIds.length} lựa chọn`
                : "0 lựa chọn"}
              placeholder="0 lựa chọn"
              onFocus={() => {
                setEmployeeSearch("");
                setEmployeeFilterOpen(true);
              }}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setEmployeeFilterOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEmployeeFilterOpen(false);
              }}
            />
            {employeeFilterOpen ? (
              <div
                id="attendance-employee-options"
                role="listbox"
                aria-multiselectable="true"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={filters.employeeIds.length === 0}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setFilters({ ...filters, employeeIds: [] });
                    setEmployeeSearch("");
                    setEmployeeFilterOpen(false);
                  }}
                >
                  Bỏ chọn tất cả
                </button>
                {matchingEmployees?.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    role="option"
                    aria-selected={filters.employeeIds.includes(employee.id)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setFilters({
                        ...filters,
                        employeeIds: filters.employeeIds.includes(employee.id)
                          ? filters.employeeIds.filter((id) => id !== employee.id)
                          : [...filters.employeeIds, employee.id],
                      });
                      setEmployeeSearch("");
                    }}
                  >
                    <span className="mr-2 inline-flex size-4 items-center justify-center rounded border border-border text-xs">
                      {filters.employeeIds.includes(employee.id) ? "✓" : ""}
                    </span>
                    {employee.fullName} · {employee.employeeNo}
                  </button>
                ))}
                {matchingEmployees?.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-ink-muted">
                    Không tìm thấy nhân viên
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <Input
              type="date"
              aria-label="Date"
              value={filters.from}
              onChange={(event) =>
                setFilters({ ...filters, from: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Input
              type="date"
              aria-label="Date"
              value={filters.to}
              onChange={(event) =>
                setFilters({ ...filters, to: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Select
              aria-label="Status"
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PRESENT">Có mặt</option>
              <option value="LATE">Đi muộn</option>
              <option value="NOT_ARRIVED">Chưa đến</option>
              <option value="ABSENT">Vắng mặt</option>
              <option value="LEAVE">Nghỉ phép</option>
              <option value="PERMIT">Nghỉ có phép</option>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-11 w-11 justify-self-start"
              aria-label={"B\u1ecf b\u1ed9 l\u1ecdc"}
              title={"B\u1ecf b\u1ed9 l\u1ecdc"}
              onClick={() => {
                setFilters({ employeeIds: [], from: "", to: "", status: "" });
                setEmployeeSearch("");
                setEmployeeFilterOpen(false);
              }}
            >
              <X />
            </Button>
          )}
        </div>
        <DataTable
          tableId="attendance-records"
          columns={RECORD_COLUMNS}
          data={list ?? []}
          loading={isLoading}
          searchable={false}
          emptyTitle="Chưa có bản ghi chấm công"
          onRowClick={(record) => {
            if (record.isScheduledPlaceholder) return;
            setDialogReviewMode(false);
            setDialogRecord(record);
          }}
        />
      </section>
      <AttendanceDayDialog
        record={dialogRecord}
        onOpenChange={closeDialog}
        reviewMode={dialogReviewMode}
        manageMode={!dialogReviewMode}
      />
    </div>
  );
}

// ---- Self-service employee view ----
function PersonalView() {
  const { data: me } = useMyAttendanceSummary();
  const { data: branches } = useBranches();
  const employeeId = useAuthStore((state) => state.user?.employeeId);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    branchId: "",
    status: "",
    approvalStatus: "",
  });
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const historyQuery = useMemo(
    () => ({
      ...(employeeId ? { employeeId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.approvalStatus
        ? {
            approvalStatus: filters.approvalStatus as
              | "APPROVED"
              | "PENDING"
              | "REJECTED",
          }
        : {}),
    }),
    [employeeId, filters],
  );
  const { data: myHistory, isLoading: isLoadingHistory } =
    useAttendanceHistory(historyQuery);
  const personalColumns = useMemo<ColumnDef<AttendanceRecord>[]>(
    () => RECORD_COLUMNS,
    [],
  );
  const [punchOpen, setPunchOpen] = useState(false);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  useEffect(() => { if (me?.enrolled === false) setFaceEnrollOpen(true); }, [me?.enrolled]);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const { data: todayRecords } = useAttendanceList(todayKey, Boolean(employeeId));
  const todayRecord = todayRecords?.[0];
  const today = me?.today;
  const attendanceStatus = todayRecord?.status ?? today?.status;
  const sessionCount = todayRecord?.sessions?.length ?? today?.sessions.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Chấm công của tôi" />

      <div className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink-muted">Trạng thái hôm nay</div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {attendanceStatus ? (
              <>
                {attendanceStatus === "NOT_ARRIVED"
                  ? <Badge tone="neutral">Chưa đến</Badge>
                  : <StatusBadge status={attendanceStatus} />}
                <ApprovalStatus status={today?.approvalDisplayStatus} />
              </>
            ) : (
              <Badge tone="neutral">Chưa chấm vào</Badge>
            )}
            <span className="min-w-0 text-sm text-ink-subtle">
              Checkin {timeOf(today?.checkInAt)} · Checkout cuối{" "}
              {timeOf(today?.checkOutAt)}
              {sessionCount ? ` · ${sessionCount} phiên` : ""}
            </span>
          </div>
        </div>
        <Button className="min-h-11 w-full shrink-0 sm:w-auto" onClick={() => setPunchOpen(true)}>
          <Fingerprint /> Chấm công
        </Button>
      </div>
      <PunchCameraDialog open={punchOpen} onOpenChange={setPunchOpen} />

      {me && !me.enrolled && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Khuôn mặt của bạn chưa được đăng ký. Hãy hoàn tất đăng ký để sử dụng chấm công.
        </div>
      )}
      {employeeId && <Dialog open={faceEnrollOpen && !me?.enrolled} onOpenChange={setFaceEnrollOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Đăng ký khuôn mặt chấm công</DialogTitle>
          <DialogDescription className="mb-4">Chỉ cần đăng ký một lần. Muốn cập nhật, hãy liên hệ quản lý để xóa mẫu hiện tại trước.</DialogDescription>
          <EnrollScanner employeeId={employeeId} onComplete={() => setFaceEnrollOpen(false)} />
          <div className="mt-3 flex justify-end"><Button type="button" variant="secondary" onClick={() => setFaceEnrollOpen(false)}>Để sau</Button></div>
        </DialogContent>
      </Dialog>}

      <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
        <DataTable
          columns={personalColumns}
          data={myHistory ?? []}
          loading={isLoadingHistory}
          searchable={false}
          pageSize={10}
          minTableWidth={0}
          tableId="attendance-personal-history"
          emptyTitle={"Ch\u01b0a c\u00f3 l\u1ecbch s\u1eed ch\u1ea5m c\u00f4ng"}
          onRowClick={(record) => {
            if (!record.isScheduledPlaceholder) setDetailRecord(record);
          }}
          toolbarContent={
            <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap">

          <div className="space-y-1">
            <Input
              type="date"
              aria-label="Date"
              value={filters.from}
              onChange={(event) =>
                setFilters({ ...filters, from: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Input
              type="date"
              aria-label="Date"
              value={filters.to}
              onChange={(event) =>
                setFilters({ ...filters, to: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Select
              aria-label="Status"
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PRESENT">Có mặt</option>
              <option value="LATE">Đi muộn</option>
              <option value="NOT_ARRIVED">Chưa đến</option>
              <option value="ABSENT">Vắng mặt</option>
              <option value="LEAVE">Nghỉ phép</option>
              <option value="PERMIT">Nghỉ có phép</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Select
              aria-label="Approval status"
              value={filters.approvalStatus}
              onChange={(event) =>
                setFilters({ ...filters, approvalStatus: event.target.value })
              }
            >
              <option value="">Tất cả</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Select aria-label="Branch" value={filters.branchId} onChange={(event) => setFilters({ ...filters, branchId: event.target.value })}>
              <option value="">T&#7845;t c&#7843; chi nh&#225;nh</option>
              {branches?.filter((branch) => branch.isActive).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-11 w-11 justify-self-start"
              aria-label={"B\u1ecf b\u1ed9 l\u1ecdc"}
              title={"B\u1ecf b\u1ed9 l\u1ecdc"}
              onClick={() =>
                setFilters({ from: "", to: "", branchId: "", status: "", approvalStatus: "" })
              }
            >
              <X />
            </Button>
          )}
                    </div>
          }
        />
      </section>
      <AttendanceDayDialog
        record={detailRecord}
        onOpenChange={(open) => !open && setDetailRecord(null)}
        allowApprovalRequest
      />
    </div>
  );
}
