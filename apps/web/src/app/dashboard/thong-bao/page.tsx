"use client";

import { Bell, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useMarkAllRead, useNotifications, useUnreadCount } from "@/features/dashboard/api";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

/** Full notification inbox; the bell in the top bar remains the quick view. */
export default function NotificationsPage() {
  const canReadNotifications = useAuthStore((state) => state.hasPermission('notification:read'));
  const { data: notifications, isLoading } = useNotifications(canReadNotifications);
  const { data: unread } = useUnreadCount(canReadNotifications);
  const markAll = useMarkAllRead();

  if (!canReadNotifications) return null;

  return <div className="space-y-6">
    <PageHeader
      title="Thông báo"
      description="Theo dõi các yêu cầu duyệt, kết quả phê duyệt và tin nhắn mới."
      action={
        <Button variant="secondary" disabled={!unread?.count || markAll.isPending} onClick={() => markAll.mutate()}>
          <CheckCheck /> Đánh dấu đã đọc
        </Button>
      }
    />
    <section className="rounded-card border border-border bg-card shadow-card">
      {isLoading ? <p className="p-6 text-sm text-ink-muted">Đang tải thông báo…</p> : notifications?.length ? <div className="divide-y divide-border">{notifications.map((notification) => <article key={notification.id} className={`p-5 ${notification.isRead ? "" : "bg-accent-purple/5"}`}><div className="flex gap-3"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${notification.isRead ? "bg-canvas text-ink-muted" : "bg-accent-purple/15 text-accent-purple"}`}><Bell className="size-4" /></span><div className="min-w-0"><h2 className="font-bold text-ink">{notification.title}</h2>{notification.body ? <p className="mt-1 text-sm text-ink-muted">{notification.body}</p> : null}<p className="mt-2 text-xs text-ink-subtle">{formatDate(notification.createdAt)}</p></div>{!notification.isRead ? <span className="ml-auto mt-1 size-2 shrink-0 rounded-full bg-accent-pink" aria-label="Chưa đọc" /> : null}</div></article>)}</div> : <EmptyState icon={Bell} title="Chưa có thông báo" description="Các cập nhật mới sẽ xuất hiện tại đây." className="border-0" />}
    </section>
  </div>;
}
