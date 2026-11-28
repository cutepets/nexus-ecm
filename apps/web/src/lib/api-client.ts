'use client';

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';

export const api = axios.create({ baseURL, withCredentials: false });

const vietnameseApiMessages: Record<string, string> = {
  'This face is already enrolled to another employee': 'Khuôn mặt này đã được đăng ký cho một nhân viên khác',
  'Employee not found': 'Không tìm thấy nhân viên',
  'Employee has no enrolled face': 'Nhân viên chưa đăng ký khuôn mặt',
  'Face not recognized': 'Không nhận diện được khuôn mặt',
  'Already checked in today': 'Hôm nay đã chấm vào',
  'No check-in found for today': 'Chưa có lượt chấm vào hôm nay',
  'Already checked out today': 'Hôm nay đã chấm ra',
  'Schedule not found': 'Không tìm thấy ca làm',
  'Invalid credentials': 'Thông tin đăng nhập không chính xác',
  'ACCOUNT_DISABLED': 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để kích hoạt lại.',
  'IP_BLOCKED': 'Địa chỉ IP này đang bị chặn. Vui lòng liên hệ quản trị viên.',
  'VIETNAM_ONLY': 'Ứng dụng chỉ cho phép truy cập từ Việt Nam.',
  'You cannot block your current IP address': 'Không thể tự chặn IP đang dùng để quản trị. Hãy nhập IP khác.',
  'Invalid IP address': 'Địa chỉ IP không hợp lệ. Hãy nhập IPv4 hoặc IPv6.',
  'Invalid refresh token': 'Phiên đăng nhập không hợp lệ',
  'Refresh token expired': 'Phiên đăng nhập đã hết hạn',
  'Refresh token reuse detected': 'Phiên đăng nhập không còn hợp lệ',
  'Not authenticated': 'Bạn chưa đăng nhập',
  'Not a member of this conversation': 'Bạn không thuộc cuộc trò chuyện này',
  'Role already exists': 'Vai trò đã tồn tại',
  'Role not found': 'Không tìm thấy vai trò',
  'User not found': 'Không tìm thấy người dùng',
  'Department not found': 'Không tìm thấy phòng ban',
  'Department code already exists': 'Mã phòng ban đã tồn tại',
  'Position not found': 'Không tìm thấy chức vụ',
  'Project not found': 'Không tìm thấy dự án',
  'Project code already exists': 'Mã dự án đã tồn tại',
  'Task not found': 'Không tìm thấy công việc',
  'Attachment not found': 'Không tìm thấy tệp đính kèm',
  'Document not found': 'Không tìm thấy tài liệu',
  'Leave request not found': 'Không tìm thấy đơn nghỉ phép',
  'Leave type not found': 'Không tìm thấy loại nghỉ phép',
  'Insufficient leave balance': 'Số ngày phép còn lại không đủ',
  'Request already finalized': 'Đơn này đã được xử lý',
  'No pending approval step': 'Không có bước duyệt đang chờ',
  'Only pending requests can be withdrawn': 'Chỉ có thể rút đơn đang chờ duyệt',
  'Akun Anda tidak tertaut ke data karyawan': 'Tài khoản chưa được liên kết với hồ sơ nhân viên',
  'Tidak diizinkan': 'Bạn không có quyền thực hiện thao tác này',
  'Email wajib diisi untuk membuat akun login': 'Cần có email để tạo tài khoản đăng nhập',
  'Email sudah digunakan oleh akun lain': 'Email đã được sử dụng bởi tài khoản khác',
  'Pengajuan ditarik': 'Đã rút đơn',
};

function localizeApiMessage(message: string) {
  if (vietnameseApiMessages[message]) return vietnameseApiMessages[message];
  // Validation libraries and legacy modules can still return English text.
  // Never surface that implementation text to a Vietnamese end user.
  if (/\b(must|should|required|invalid|not found|already|cannot|only|need|insufficient)\b/i.test(message)) return 'Dữ liệu không hợp lệ hoặc không thể xử lý yêu cầu.';
  return message;
}

function localizeApiError(error: AxiosError) {
  const body = error.response?.data as { message?: string | string[] } | undefined;
  if (!body?.message) return;
  body.message = Array.isArray(body.message) ? body.message.map(localizeApiMessage) : localizeApiMessage(body.message);
}

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Refresh-token rotation on 401 ---
let isRefreshing = false;
let queue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];
const refreshLockKey = 'nexus-auth-refresh-lock';

async function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('nexus-auth-refresh', work);
  }

  // Coordinate tabs on browsers without the Web Locks API. The persisted
  // tokens are re-read after acquiring the lease, so waiting tabs reuse the
  // token pair written by the tab that performed the rotation.
  if (typeof window === 'undefined') return work();
  const storage = window.localStorage;
  const owner = `${Date.now()}-${Math.random()}`;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  while (true) {
    const now = Date.now();
    let expiresAt = 0;
    try {
      expiresAt = Number((JSON.parse(storage.getItem(refreshLockKey) ?? '{}') as { expiresAt?: number }).expiresAt ?? 0);
    } catch {
      expiresAt = 0;
    }
    if (expiresAt <= now) {
      storage.setItem(refreshLockKey, JSON.stringify({ owner, expiresAt: now + 15_000 }));
      const lock = JSON.parse(storage.getItem(refreshLockKey) ?? '{}') as { owner?: string };
      if (lock.owner === owner) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  heartbeat = setInterval(() => {
    try {
      const lock = JSON.parse(storage.getItem(refreshLockKey) ?? '{}') as { owner?: string };
      if (lock.owner === owner) {
        storage.setItem(refreshLockKey, JSON.stringify({ owner, expiresAt: Date.now() + 15_000 }));
      }
    } catch {
      // The lease expires naturally if storage becomes unavailable.
    }
  }, 5_000);

  try {
    return await work();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    try {
      const lock = JSON.parse(storage.getItem(refreshLockKey) ?? '{}') as { owner?: string };
      if (lock.owner === owner) storage.removeItem(refreshLockKey);
    } catch {
      // A failed release is bounded by the lease expiration.
    }
  }
}

function flushQueue(error: unknown, token: string | null) {
  queue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  queue = [];
}

async function rotateRefreshToken(staleRefreshToken: string) {
  const rotate = async () => {
    const current = useAuthStore.getState();
    // Another tab may have completed rotation while this tab waited for the lock.
    if (current.refreshToken && current.refreshToken !== staleRefreshToken && current.accessToken) {
      return { accessToken: current.accessToken, refreshToken: current.refreshToken };
    }

    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/auth/refresh`,
      { refreshToken: staleRefreshToken },
    );
    current.setTokens(data);
    return data;
  };

  return withRefreshLock(rotate);
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    localizeApiError(error);
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const { refreshToken, clear } = useAuthStore.getState();

    const isAuthRoute = original?.url?.includes('/auth/');
    if (error.response?.status !== 401 || original._retry || isAuthRoute || !refreshToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Wait for the in-flight refresh, then retry.
      return new Promise((resolve, reject) => {
        queue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const tokens = await rotateRefreshToken(refreshToken);
      flushQueue(null, tokens.accessToken);
      original.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return api(original);
    } catch (err) {
      const latest = useAuthStore.getState();
      if (latest.refreshToken !== refreshToken && latest.accessToken) {
        flushQueue(null, latest.accessToken);
        original.headers.Authorization = `Bearer ${latest.accessToken}`;
        return api(original);
      }
      flushQueue(err, null);
      clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
