import { Badge, type BadgeProps } from "@/components/ui/badge";

type Tone = NonNullable<BadgeProps["tone"]>;

/**
 * Maps domain status strings to badge tones. Covers the statuses used across
 * attendance, leave, projects, and tasks. Unknown values fall back
 * to neutral, so it is safe to pass any status string.
 */
const STATUS_TONE: Record<string, Tone> = {
  // generic
  ACTIVE: "mint",
  INACTIVE: "red",
  PROBATION: "amber",
  PERMANENT: "mint",
  ON_LEAVE: "cyan",
  UPCOMING_EXIT: "red",
  ABANDONED: "purple",
  PENDING: "amber",
  APPROVED: "mint",
  REJECTED: "red",
  NEEDS_MORE_INFO: "amber",
  CANCELLED: "neutral",
  DRAFT: "neutral",
  // attendance
  PRESENT: "mint",
  LATE: "amber",
  ABSENT: "red",
  LEAVE: "purple",
  PERMIT: "cyan",
  // projects / tasks
  PLANNED: "neutral",
  IN_PROGRESS: "cyan",
  ON_HOLD: "amber",
  COMPLETED: "mint",
  DONE: "mint",
  TODO: "neutral",
  REVIEW: "purple",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  PENDING: "Chờ xử lý",
  APPROVED: "Đã duyệt",
  APPROVE: "Phê duyệt",
  REJECTED: "Từ chối",
  NEEDS_MORE_INFO: "Cần bổ sung",
  REJECT: "Từ chối",
  CANCELLED: "Đã hủy",
  DRAFT: "Bản nháp",
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  ABSENT: "Vắng mặt",
  LEAVE: "Nghỉ phép",
  PERMIT: "Nghỉ có phép",
  PROBATION: "Thử việc",
  PERMANENT: "Chính thức",
  CONTRACT: "Hợp đồng",
  ON_LEAVE: "Tạm nghỉ",
  UPCOMING_EXIT: "Sắp nghỉ",
  ABANDONED: "Bỏ việc",
  PLANNING: "Lập kế hoạch",
  PLANNED: "Đã lên kế hoạch",
  IN_PROGRESS: "Đang thực hiện",
  ON_HOLD: "Tạm dừng",
  COMPLETED: "Hoàn thành",
  TODO: "Cần thực hiện",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
  SOP: "Quy trình",
  KTP: "Giấy tờ tùy thân",
  NPWP: "Mã số thuế",
  CV: "Hồ sơ năng lực",
  LETTER: "Văn bản",
  OTHER: "Khác",
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
  EXPORT: "Xuất dữ liệu",
};

function statusLabel(status: string) {
  const normalized = status?.toUpperCase();
  return STATUS_LABEL[normalized] ?? status.replaceAll("_", " ").toLowerCase();
}

export interface StatusBadgeProps {
  status: string;
  /** Override the auto-derived label. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = STATUS_TONE[status?.toUpperCase()] ?? "neutral";
  return <Badge tone={tone}>{label ?? statusLabel(status)}</Badge>;
}
