"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BlockedIp = {
  ipAddress: string;
  blockedAt: string;
  expiresAt: string | null;
  isPermanent: boolean;
  reason: string | null;
};

export function SecurityAccessSettings() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canReadSettings = hasPermission("settings:read");
  const canUpdateSettings = hasPermission("settings:update");
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState(60);
  const [newIp, setNewIp] = useState("");
  const [permanent, setPermanent] = useState(false);

  const settings = useQuery({
    queryKey: ["security", "ip-settings"],
    queryFn: async () => (await api.get<{ autoUnblockMinutes: number }>("/security/ip-settings")).data,
    enabled: canReadSettings,
  });
  const blockedIps = useQuery({
    queryKey: ["security", "ip-blocks"],
    queryFn: async () => (await api.get<BlockedIp[]>("/security/ip-blocks")).data,
    enabled: canReadSettings,
  });
  useEffect(() => {
    if (settings.data) setDuration(settings.data.autoUnblockMinutes);
  }, [settings.data]);

  const refreshIpData = () => {
    queryClient.invalidateQueries({ queryKey: ["security", "ip-blocks"] });
    queryClient.invalidateQueries({ queryKey: ["security", "ip-settings"] });
  };
  const updateSettings = useMutation({
    mutationFn: () => api.put("/security/ip-settings", { autoUnblockMinutes: Number(duration) }),
    onSuccess: () => { refreshIpData(); toast.success("Đã lưu thời gian tự mở chặn."); },
    onError: () => toast.error("Không thể lưu cài đặt IP."),
  });
  const blockIp = useMutation({
    mutationFn: () => api.put(`/security/ip-blocks/${encodeURIComponent(newIp.trim())}`, { isPermanent: permanent }),
    onSuccess: () => { setNewIp(""); refreshIpData(); toast.success("Đã chặn IP."); },
    onError: (error) => {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(", ") : message ?? "Không thể chặn IP. Hãy kiểm tra địa chỉ và thử lại.");
    },
  });
  const unblockIp = useMutation({
    mutationFn: (ip: string) => api.delete(`/security/ip-blocks/${encodeURIComponent(ip)}`),
    onSuccess: refreshIpData,
    onError: () => toast.error("Không thể mở chặn IP."),
  });

  return (
    <div className="space-y-5">
      {canReadSettings && <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl bg-accent-purple/10 p-2 text-purple-700"><ShieldAlert className="size-5" /></span>
          <div><h2 className="font-semibold text-ink">Giới hạn truy cập IP</h2><p className="text-sm text-ink-muted">Chỉ cho phép IP xác định tại Việt Nam. Tự chặn IP sau 5 lần đăng nhập sai trong 1 giờ.</p></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={(event) => { event.preventDefault(); updateSettings.mutate(); }}>
            <label className="block space-y-1.5 text-sm font-medium">Tự mở chặn sau (phút)
              <Input type="number" min={5} max={10080} value={duration} onChange={(event) => setDuration(Number(event.target.value))} onFocus={() => settings.data && setDuration(settings.data.autoUnblockMinutes)} disabled={!canUpdateSettings} />
            </label>
            {canUpdateSettings && <Button type="submit" disabled={updateSettings.isPending}>Lưu thời hạn</Button>}
            <p className="text-xs text-ink-muted">Giá trị áp dụng cho các lần tự chặn và chặn có thời hạn tiếp theo (5 phút đến 7 ngày).</p>
          </form>
          {canUpdateSettings && <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={(event) => { event.preventDefault(); blockIp.mutate(); }}>
            <label className="block space-y-1.5 text-sm font-medium">Chặn IP thủ công
              <Input value={newIp} onChange={(event) => setNewIp(event.target.value)} placeholder="203.0.113.10" required />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={permanent} onChange={(event) => setPermanent(event.target.checked)} />Chặn vĩnh viễn</label>
            <Button type="submit" variant="danger" disabled={blockIp.isPending}>Chặn IP</Button>
            <p className="text-xs text-ink-muted">Không thể chặn IP đang dùng cho phiên quản trị hiện tại để tránh tự khóa quyền truy cập.</p>
          </form>}
        </div>
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Danh sách IP đang bị chặn</h3>
          {blockedIps.isLoading ? <p className="text-sm text-ink-muted">Đang tải…</p> : !blockedIps.data?.length ? <p className="rounded-xl bg-canvas p-4 text-sm text-ink-muted">Hiện không có IP bị chặn.</p> : <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-canvas text-ink-muted"><tr><th className="p-3">Địa chỉ IP</th><th className="p-3">Lý do</th><th className="p-3">Mở chặn</th><th className="p-3"></th></tr></thead><tbody>{blockedIps.data.map((entry) => <tr key={entry.ipAddress} className="border-t border-border"><td className="p-3 font-mono">{entry.ipAddress}</td><td className="p-3">{entry.isPermanent ? "Vĩnh viễn" : entry.reason === "AUTO_LOGIN_FAILURES" ? "5 lần đăng nhập sai" : "Chặn thủ công"}</td><td className="p-3">{entry.isPermanent || !entry.expiresAt ? "Không tự mở" : new Date(entry.expiresAt).toLocaleString("vi-VN")}</td><td className="p-3 text-right">{canUpdateSettings && <Button type="button" variant="secondary" size="sm" onClick={() => unblockIp.mutate(entry.ipAddress)}>Mở chặn</Button>}</td></tr>)}</tbody></table></div>}
        </div>
      </section>}
    </div>
  );
}
