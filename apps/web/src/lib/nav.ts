import {
  LayoutDashboard, Users, Fingerprint, ClipboardCheck, CalendarDays, FolderKanban,
  ListTodo, FileText, MessagesSquare, History, Bell, UserRoundPlus, type LucideIcon,
} from 'lucide-react';

export interface NavItem { label: string; href: string; icon: LucideIcon; permission?: string; separatorBefore?: boolean; }

/** Điều hướng cho bản Nhân sự và Chấm công. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Chấm công', href: '/dashboard/absensi', icon: Fingerprint, permission: 'attendance:read' },
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard, separatorBefore: true },
  { label: 'Xếp ca', href: '/dashboard/kalender', icon: CalendarDays, separatorBefore: true },
  { label: 'Lịch sử', href: '/dashboard/absensi/lich-su', icon: History, permission: 'attendance:update' },
  { label: 'Phê duyệt', href: '/dashboard/phe-duyet', icon: ClipboardCheck },
  { label: 'Thông báo', href: '/dashboard/thong-bao', icon: Bell },
  { label: 'Nhân viên', href: '/dashboard/karyawan', icon: Users, permission: 'employee:read', separatorBefore: true },
  { label: 'Ứng viên', href: '/dashboard/ung-vien', icon: UserRoundPlus, permission: 'candidate:read' },
  { label: 'Dự án', href: '/dashboard/proyek', icon: FolderKanban, permission: 'project:read', separatorBefore: true },
  { label: 'Công việc', href: '/dashboard/tugas', icon: ListTodo, permission: 'task:read' },
  { label: 'Tài liệu', href: '/dashboard/dokumen', icon: FileText, permission: 'document:read' },
  { label: 'Trò chuyện', href: '/dashboard/chat', icon: MessagesSquare },
];
