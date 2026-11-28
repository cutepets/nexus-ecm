"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, HardDrive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useSelectStorageProvider,
  useStartGoogleDriveOAuth,
  useStorageSettings,
  useTestGoogleDriveConnection,
  useUpdateGoogleDriveOAuthSettings,
} from "@/features/settings/api";

export function StorageSettings({ canUpdate }: { canUpdate: boolean }) {
  const { data, isLoading, isError } = useStorageSettings();
  const saveOAuth = useUpdateGoogleDriveOAuthSettings();
  const startOAuth = useStartGoogleDriveOAuth();
  const test = useTestGoogleDriveConnection();
  const select = useSelectStorageProvider();
  const [folderId, setFolderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (!data) return;
    setFolderId(data.googleDriveFolderId);
    setClientId(data.googleDriveOAuthClientId);
  }, [data]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("drive_oauth");
    if (!result) return;
    if (result === "success") toast.success("Đã kết nối Google Drive thành công.");
    else toast.error("Kết nối Google Drive chưa thành công. Hãy kiểm tra OAuth Client và thử lại.");
    url.searchParams.delete("drive_oauth");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const connectOAuth = async () => {
    try {
      await saveOAuth.mutateAsync({
        clientId,
        folderId,
        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
      });
      setClientSecret("");
      const authorization = await startOAuth.mutateAsync();
      window.location.assign(authorization.url);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(" ") : message || "Không bắt đầu được kết nối Google.");
    }
  };

  const testConnection = async () => {
    try {
      const result = await test.mutateAsync();
      toast.success(`Kết nối thành công: ${result.folderName} (${result.clientEmail}).`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(" ") : message || "Không kết nối được Google Drive.");
    }
  };

  const showSelectionError = (error: unknown) => {
    const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    toast.error(Array.isArray(message) ? message.join(" ") : message || "Không đổi được chế độ lưu trữ.");
  };

  if (isLoading) return <div className="rounded-card border border-border bg-card p-6 text-sm text-ink-muted">Đang tải cấu hình lưu trữ…</div>;
  if (isError || !data) return <div className="rounded-card border border-border bg-card p-6 text-sm text-red-700">Không tải được cấu hình lưu trữ.</div>;

  return (
    <section className="space-y-5 rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-accent-purple/15 p-2 text-purple-700"><HardDrive className="size-5" /></span>
        <div>
          <h2 className="font-semibold text-ink">Lưu trữ ảnh & tài liệu</h2>
          <p className="text-sm text-ink-muted">Chọn nơi lưu tệp tải lên của hệ thống.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" disabled={!canUpdate || select.isPending} onClick={() => select.mutate("MINIO", {
          onSuccess: () => toast.success("Đã chọn lưu trữ trên máy chủ."), onError: showSelectionError,
        })} className={`rounded-2xl border p-4 text-left transition-colors ${data.storageProvider === "MINIO" ? "border-purple-400 bg-purple-50" : "border-border hover:bg-canvas"}`}>
          <span className="flex items-center gap-2 font-semibold"><HardDrive className="size-4" /> Lưu trên máy chủ (MinIO)</span>
          <span className="mt-1 block text-sm text-ink-muted">Tệp được lưu trong kho VPS hiện tại.</span>
        </button>
        <button type="button" disabled={!canUpdate || !data.connectionVerified || select.isPending} onClick={() => select.mutate("GOOGLE_DRIVE", {
          onSuccess: () => toast.success("Đã chọn lưu trữ Google Drive."), onError: showSelectionError,
        })} className={`rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${data.storageProvider === "GOOGLE_DRIVE" ? "border-purple-400 bg-purple-50" : "border-border hover:bg-canvas"}`}>
          <span className="flex items-center gap-2 font-semibold"><Cloud className="size-4" /> Lưu trên Google Drive</span>
          <span className="mt-1 block text-sm text-ink-muted">Chỉ chọn được sau khi kiểm tra kết nối thành công.</span>
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border p-4">
        <div>
          <h3 className="font-semibold text-ink">Kết nối Google Drive cá nhân</h3>
          <p className="mt-1 text-sm text-ink-muted">Kết nối bằng tài khoản Google cá nhân của anh. Tệp được lưu trong thư mục thuộc My Drive.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-ink">Google Drive folder ID
            <Input value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={!canUpdate} placeholder="ID thư mục trong My Drive" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-ink">OAuth Client ID
            <Input value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={!canUpdate} placeholder="...apps.googleusercontent.com" />
          </label>
        </div>
        <label className="block max-w-2xl space-y-1.5 text-sm font-medium text-ink">OAuth Client Secret
          <Input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} disabled={!canUpdate} autoComplete="new-password" placeholder={data.oauthClientSecretConfigured ? "Đã lưu an toàn; nhập nếu muốn thay" : "Nhập Client Secret"} />
        </label>
        <div className="space-y-1 rounded-xl bg-canvas p-3 text-sm">
          <p className="font-medium">Authorized redirect URI trong Google Cloud</p>
          <code className="block break-all text-xs text-ink-muted">{data.oauthRedirectUri}</code>
        </div>
        {data.oauthConnected && <p className="text-sm text-ink-muted">Đã liên kết với {data.googleDriveOAuthEmail || "tài khoản Google"}.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={connectOAuth} disabled={!canUpdate || saveOAuth.isPending || startOAuth.isPending || !folderId.trim() || !clientId.trim() || (!clientSecret.trim() && !data.oauthClientSecretConfigured)}>
            <Cloud className="size-4" /> {saveOAuth.isPending || startOAuth.isPending ? "Đang chuyển đến Google…" : data.oauthConnected ? "Kết nối lại tài khoản Google" : "Lưu và kết nối Google"}
          </Button>
          <Button type="button" variant="secondary" onClick={testConnection} disabled={!canUpdate || !data.oauthConnected || test.isPending}>
            <RefreshCw className={`size-4 ${test.isPending ? "animate-spin" : ""}`} /> Kiểm tra kết nối
          </Button>
          {data.connectionVerified && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700"><CheckCircle2 className="size-4" /> Kết nối đã xác minh</span>}
        </div>
        <p className="text-xs text-ink-muted">Trong Google Cloud, bật Google Drive API, tạo OAuth Client loại Web application và thêm URI bên trên. Nếu ứng dụng đang ở chế độ Testing, thêm email Google của anh vào danh sách test users.</p>
      </div>
    </section>
  );
}
