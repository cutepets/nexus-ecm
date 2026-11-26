"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2, ClipboardCheck, FilePenLine, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useAttendanceHistory, type AttendanceRecord } from "@/features/attendance/api";
import { useLeaveRequests, type LeaveRequest } from "@/features/leave/api";
import { EmptyState } from "@/components/shared/empty-state";

type ApprovalItem = {
  id: string;
  kind: "ATTENDANCE" | "LEAVE";
  employee: string;
  subtitle: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
  createdAt: string;
  href: string;
};

function legacyAttendanceItem(record: AttendanceRecord): ApprovalItem | null {
  if (!record.exceptionType && !record.approvalDisplayStatus) return null;
  return {
    id: `attendance-${record.id}`,
    kind: "ATTENDANCE",
    employee: record.employee.fullName,
    subtitle: `${new Date(record.workDate).toLocaleDateString("vi-VN")} · ${record.approvalReasons?.join(", ") || record.exceptionType || "Sửa công"}`,
    status: record.approvalDisplayStatus ?? record.approvalStatus,
    createdAt: record.workDate,
    href: `/dashboard/absensi?mode=history&attendanceId=${encodeURIComponent(record.id)}&review=1`,
  };
}

const attendanceReasonLabel: Record<string, string> = {
  WRONG_SCHEDULE: "Đổi ca / sai ca",
  GPS_UNAVAILABLE: "Lỗi GPS hoặc vị trí",
  FACE_UNRECOGNIZED: "Lỗi nhận diện khuôn mặt",
  MISSED_PUNCH: "Quên chấm công",
  LATE_ARRIVAL: "Xin đi muộn (miễn phạt)",
  OVERTIME: "Làm thêm giờ",
  OTHER: "Lý do khác",
};

function attendanceItem(record: AttendanceRecord): ApprovalItem | null {
  if (!record.exceptionType && !record.approvalDisplayStatus) return null;
  const reasons = (record.approvalItems?.length
    ? record.approvalItems.map((item) => {
        const label = attendanceReasonLabel[item.type] ?? item.type;
        if (item.type === "WRONG_SCHEDULE" && item.workScheduleName)
          return `${label}: ${item.workScheduleName}`;
        if (item.type === "OVERTIME") return `${label}: ${item.overtimeMinutes ?? 0} phút`;
        return label;
      })
    : (record.approvalReasons ?? (record.exceptionType ? [record.exceptionType] : []))
        .map((reason) => attendanceReasonLabel[reason] ?? reason))
    .join(", ");
  return {
    id: `attendance-${record.id}`,
    kind: "ATTENDANCE",
    employee: record.employee.fullName,
    subtitle: `${new Date(record.workDate).toLocaleDateString("vi-VN")} · ${reasons || "Sửa công"}`,
    status: record.approvalDisplayStatus ?? record.approvalStatus,
    createdAt: record.workDate,
    href: `/dashboard/absensi?mode=history&attendanceId=${encodeURIComponent(record.id)}&review=1`,
  };
}

function leaveItem(request: LeaveRequest): ApprovalItem {
  return {
    id: `leave-${request.id}`,
    kind: "LEAVE",
    employee: request.employee.fullName,
    subtitle: `${request.leaveType.name} · ${new Date(request.startDate).toLocaleDateString("vi-VN")} – ${new Date(request.endDate).toLocaleDateString("vi-VN")}`,
    status: request.status,
    createdAt: request.createdAt,
    href: `/dashboard/cuti/${request.id}`,
  };
}

function ApprovalList({ items, empty }: { items: ApprovalItem[]; empty: string }) {
  if (!items.length) return <EmptyState icon={ClipboardCheck} title={empty} className="border border-border bg-card" />;
  return <div className="space-y-2">{items.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:bg-canvas"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium">{item.employee}</span><span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-muted">{item.kind === "LEAVE" ? "Nghỉ phép" : "Sửa công"}</span></div><p className="mt-1 truncate text-sm text-ink-muted">{item.subtitle}</p></div><StatusBadge status={item.status} /></Link>)}</div>;
}

export default function ApprovalCenterPage() {
  const canApproveLeave = useAuthStore((state) => state.hasPermission("leave:approve"));
  const canApproveAttendance = useAuthStore((state) => state.hasPermission("attendance:review"));
  const { data: leaves, isLoading: leavesLoading } = useLeaveRequests();
  const { data: attendance, isLoading: attendanceLoading } = useAttendanceHistory({});
  const items = useMemo(() => [
    ...(canApproveLeave ? (leaves ?? []).map(leaveItem) : []),
    ...(canApproveAttendance ? (attendance ?? []).map(attendanceItem).filter((item): item is ApprovalItem => Boolean(item)) : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [attendance, canApproveAttendance, canApproveLeave, leaves]);
  const pending = items.filter((item) => item.status === "PENDING");
  const supplement = items.filter((item) => item.status === "NEEDS_MORE_INFO");
  const rejected = items.filter((item) => item.status === "REJECTED");
  const approved = items.filter((item) => item.status === "APPROVED");

  if (!canApproveLeave && !canApproveAttendance) return <EmptyState icon={ClipboardCheck} title="Không có quyền phê duyệt" description="Mục này dành cho người quản lý hoặc quản trị viên." />;
  return <div className="space-y-6"><PageHeader title="Phê duyệt" description="Duyệt nghỉ phép và các yêu cầu sửa công. Bấm một dòng để xem chi tiết và xử lý." /><Tabs defaultValue="pending"><TabsList className="flex max-w-full overflow-x-auto"><TabsTrigger value="all">Tất cả ({items.length})</TabsTrigger><TabsTrigger value="pending">Chờ duyệt ({pending.length})</TabsTrigger><TabsTrigger value="supplement">Bổ sung ({supplement.length})</TabsTrigger><TabsTrigger value="rejected">Từ chối ({rejected.length})</TabsTrigger><TabsTrigger value="approved">Đã duyệt ({approved.length})</TabsTrigger></TabsList><p className="mt-3 text-sm text-ink-muted">{leavesLoading || attendanceLoading ? "Đang tải danh sách phê duyệt…" : ""}</p><TabsContent value="all"><ApprovalList items={items} empty="Chưa có yêu cầu phê duyệt" /></TabsContent><TabsContent value="pending"><ApprovalList items={pending} empty="Không có yêu cầu chờ duyệt" /></TabsContent><TabsContent value="supplement"><ApprovalList items={supplement} empty="Không có yêu cầu cần bổ sung" /></TabsContent><TabsContent value="rejected"><ApprovalList items={rejected} empty="Không có yêu cầu bị từ chối" /></TabsContent><TabsContent value="approved"><ApprovalList items={approved} empty="Chưa có yêu cầu đã duyệt" /></TabsContent></Tabs></div>;
}
