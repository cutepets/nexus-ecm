'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLogin } from '@/features/auth/api';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('admin@nexus.local');
  const [password, setPassword] = useState('Admin123!');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => router.push('/dashboard') },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-medium tracking-tight">Nexus ECM</h1>
          <p className="mt-1 text-sm text-ink-muted">Masuk ke akun Anda</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
              required
            />
          </div>

          {login.isError && (
            <p className="rounded-lg bg-accent-pink/15 px-3 py-2 text-sm text-pink-700">
              Email atau password salah.
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {login.isPending ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-subtle">
          Default: admin@nexus.local / Admin123!
        </p>
      </div>
    </main>
  );
}
