import {
  LayoutDashboard, Users, Fingerprint, ClipboardCheck, CalendarDays, FolderKanban,
  ListTodo, FileText, MessagesSquare, History, Bell, type LucideIcon,
} from 'lucide-react';

export interface NavItem { label: string; href: string; icon: LucideIcon; permission?: string; }

/** Điều hướng cho bản Nhân sự và Chấm công. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Chấm công', href: '/dashboard/absensi', icon: Fingerprint, permission: 'attendance:read' },
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Lịch', href: '/dashboard/kalender', icon: CalendarDays },
  { label: 'Nhân viên', href: '/dashboard/karyawan', icon: Users, permission: 'employee:read' },
  { label: 'Lịch sử chấm công', href: '/dashboard/absensi/lich-su', icon: History, permission: 'attendance:update' },
  { label: 'Phê duyệt', href: '/dashboard/phe-duyet', icon: ClipboardCheck, permission: 'leave:approve' },
  { label: 'Thông báo', href: '/dashboard/thong-bao', icon: Bell },
  { label: 'Dự án', href: '/dashboard/proyek', icon: FolderKanban, permission: 'project:read' },
  { label: 'Công việc', href: '/dashboard/tugas', icon: ListTodo, permission: 'task:read' },
  { label: 'Tài liệu', href: '/dashboard/dokumen', icon: FileText, permission: 'document:read' },
  { label: 'Trò chuyện', href: '/dashboard/chat', icon: MessagesSquare },
];
