'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useChangeMyPassword } from '@/features/users/self-profile';
import { useAuthStore } from '@/stores/auth-store';

export function PasswordOnboardingDialog() {
  const user = useAuthStore((state) => state.user);
  const setMustChangePassword = useAuthStore((state) => state.setMustChangePassword);
  const changePassword = useChangeMyPassword();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!user?.mustChangePassword) return;
    const dismissed = sessionStorage.getItem(`password-change-dismissed:${user.id}`) === '1';
    setOpen(!dismissed);
  }, [user?.id, user?.mustChangePassword]);

  const dismiss = () => {
    if (user) sessionStorage.setItem(`password-change-dismissed:${user.id}`, '1');
    setOpen(false);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận chưa khớp');
      return;
    }
    changePassword.mutate({ currentPassword, newPassword }, {
      onSuccess: () => {
        setMustChangePassword(false);
        sessionStorage.removeItem(`password-change-dismissed:${user?.id}`);
        setOpen(false);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        toast.success('Đã đổi mật khẩu');
      },
      onError: () => toast.error('Không thể đổi mật khẩu. Hãy kiểm tra mật khẩu hiện tại và thử lại.'),
    });
  };

  if (!user?.mustChangePassword) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="p-6">
        <DialogTitle>Đổi mật khẩu khởi tạo</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">
          Tài khoản đang dùng mật khẩu khởi tạo. Bạn có thể đổi ngay hoặc đóng cửa sổ để thực hiện sau trong mục Hồ sơ.
        </DialogDescription>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <Input type="password" autoComplete="current-password" placeholder="Mật khẩu hiện tại" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <Input type="password" autoComplete="new-password" placeholder="Mật khẩu mới (ít nhất 8 ký tự)" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <Input type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="secondary">Để sau</Button></DialogClose>
            <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
