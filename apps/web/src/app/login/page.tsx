'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLogin } from '@/features/auth/api';
import { useCompanyBranding } from '@/features/settings/api';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const { data: branding } = useCompanyBranding();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const loginError = (login.error as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data?.message;
  const loginErrorCode = Array.isArray(loginError) ? loginError[0] : loginError;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { identifier: identifier.trim(), password, rememberMe },
      { onSuccess: () => router.replace('/dashboard/absensi') },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          {branding?.logoUrl ? (
            // The company logo is served from storage and may use a tenant-specific URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.companyName} className="mx-auto mb-4 size-20 rounded-2xl object-contain" />
          ) : (
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-white">
              {(branding?.companyName || 'Nexus ECM').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{branding?.companyName || 'Nexus ECM'}</h1>
          <p className="mt-1 text-sm text-ink-muted">Phần mềm quản lý nhân sự &amp; chấm công</p>
          <p className="mt-1 text-sm text-ink-muted">Đăng nhập vào tài khoản của bạn</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              Tên đăng nhập, số điện thoại hoặc email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin, 0901234567 hoặc admin@gmail.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
              required
              autoComplete="current-password"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded border-border text-accent-purple focus:ring-accent-purple/30"
            />
            Nhớ đăng nhập trên thiết bị này
          </label>

          {login.isError && (
            <p className="rounded-lg bg-accent-pink/15 px-3 py-2 text-sm text-pink-700">
              {loginErrorCode === 'ACCOUNT_DISABLED' || loginErrorCode?.includes('Tài khoản đã bị vô hiệu hóa')
                ? 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'
                : loginErrorCode === 'IP_BLOCKED' || loginErrorCode?.includes('Địa chỉ IP này đang bị chặn')
                  ? 'Địa chỉ IP này đang bị chặn. Vui lòng liên hệ quản trị viên.'
                  : loginErrorCode === 'VIETNAM_ONLY' || loginErrorCode?.includes('chỉ cho phép truy cập từ Việt Nam')
                    ? 'Ứng dụng chỉ cho phép đăng nhập từ Việt Nam.'
                    : 'Thông tin đăng nhập hoặc mật khẩu không đúng.'}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </main>
  );
}
