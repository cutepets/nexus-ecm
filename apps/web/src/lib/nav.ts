import {
  LayoutDashboard,
  Users,
  Fingerprint,
  CalendarOff,
  CalendarDays,
  FolderKanban,
  ListTodo,
  Wallet,
  Boxes,
  Contact,
  FileText,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this item; undefined = always visible. */
  permission?: string;
}

/** Primary sidebar navigation. Order follows the product roadmap (docs/05-ROADMAP.md). */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Kalender', href: '/dashboard/kalender', icon: CalendarDays },
  { label: 'Karyawan', href: '/dashboard/karyawan', icon: Users, permission: 'employee:read' },
  { label: 'Absensi', href: '/dashboard/absensi', icon: Fingerprint, permission: 'attendance:read' },
  { label: 'Cuti', href: '/dashboard/cuti', icon: CalendarOff, permission: 'leave:read' },
  { label: 'Proyek', href: '/dashboard/proyek', icon: FolderKanban, permission: 'project:read' },
  { label: 'Tugas', href: '/dashboard/tugas', icon: ListTodo, permission: 'task:read' },
  { label: 'Keuangan', href: '/dashboard/keuangan', icon: Wallet, permission: 'finance:read' },
  { label: 'Inventory', href: '/dashboard/inventory', icon: Boxes, permission: 'inventory:read' },
  { label: 'CRM', href: '/dashboard/crm', icon: Contact, permission: 'crm:read' },
  { label: 'Dokumen', href: '/dashboard/dokumen', icon: FileText, permission: 'document:read' },
  { label: 'Chat', href: '/dashboard/chat', icon: MessagesSquare },
];
