import {
  LayoutDashboard, Users, Fingerprint, ClipboardCheck, CalendarDays, FolderKanban,
  ListTodo, FileText, MessagesSquare, History, Bell, UserRoundPlus, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  anyPermissions?: readonly string[];
  permissionGroups?: readonly (readonly string[])[];
  separatorBefore?: boolean;
}

/** Điều hướng cho bản Nhân sự và Chấm công. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Chấm công', href: '/dashboard/absensi', icon: Fingerprint, permission: 'attendance:read' },
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard, separatorBefore: true },
  { label: 'Xếp ca', href: '/dashboard/kalender', icon: CalendarDays, permission: 'attendance:read', separatorBefore: true },
  { label: 'Lịch sử', href: '/dashboard/absensi/lich-su', icon: History, permission: 'attendance:update' },
  { label: 'Phê duyệt', href: '/dashboard/phe-duyet', icon: ClipboardCheck, permissionGroups: [['leave:approve'], ['attendance:review', 'attendance:read']] },
  { label: 'Thông báo', href: '/dashboard/thong-bao', icon: Bell, permission: 'notification:read' },
  { label: 'Nhân viên', href: '/dashboard/karyawan', icon: Users, permission: 'employee:read', separatorBefore: true },
  { label: 'Ứng viên', href: '/dashboard/ung-vien', icon: UserRoundPlus, permission: 'candidate:read' },
  { label: 'Dự án', href: '/dashboard/proyek', icon: FolderKanban, permission: 'project:read', separatorBefore: true },
  { label: 'Công việc', href: '/dashboard/tugas', icon: ListTodo, permission: 'task:read' },
  { label: 'Tài liệu', href: '/dashboard/dokumen', icon: FileText, permission: 'document:read' },
  { label: 'Trò chuyện', href: '/dashboard/chat', icon: MessagesSquare, permission: 'chat:read' },
];

export function canAccessNavItem(item: NavItem, hasPermission: (permission: string) => boolean) {
  if (item.permission && !hasPermission(item.permission)) return false;
  if (item.permissionGroups?.length && !item.permissionGroups.some((group) => group.every(hasPermission))) return false;
  return !item.anyPermissions?.length || item.anyPermissions.some(hasPermission);
}

export function findNavItemForPath(pathname: string) {
  const routeAccessItems: NavItem[] = [
    {
      label: 'Cài đặt', href: '/dashboard/pengaturan', icon: CalendarDays,
      anyPermissions: ['settings:read', 'audit:read', 'branch:read', 'attendance-policy:read', 'payroll:read', 'integration:read', 'rbac:read'],
    },
    { label: 'Phân quyền', href: '/dashboard/phan-quyen', icon: CalendarDays, permission: 'rbac:read' },
  ];
  return [...NAV_ITEMS, ...routeAccessItems]
    .filter((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)))
    .sort((left, right) => right.href.length - left.href.length)[0];
}
