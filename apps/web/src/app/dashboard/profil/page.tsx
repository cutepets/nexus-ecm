'use client';

/* eslint-disable @next/next/no-img-element -- avatarPreview may be a local object URL while the user is editing. */

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, Crop, KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth-store';
import { uploadMyAvatar, useChangeMyPassword, useMyProfile, useUpdateMyProfile } from '@/features/users/self-profile';
import { AvatarCropDialog } from '@/features/users/avatar-crop-dialog';

export default function ProfilPage() {
  const { data: profile, isLoading } = useMyProfile();
  const queryClient = useQueryClient();
  const update = useUpdateMyProfile();
  const changePassword = useChangeMyPassword();
  const fileRef = useRef<HTMLInputElement>(null);
  const [salaryBankName, setSalaryBankName] = useState('');
  const [salaryBankAccount, setSalaryBankAccount] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPortraitFile, setAvatarPortraitFile] = useState<File | null>(null);
  const [avatarCropPreview, setAvatarCropPreview] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [cropCandidate, setCropCandidate] = useState<{ file: File; sourceUrl: string; shape: 'circle' | 'portrait' } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!profile) return;
    setSalaryBankName(profile.employee?.salaryBankName ?? '');
    setSalaryBankAccount(profile.employee?.salaryBankAccount ?? '');
    setAvatarPreview(profile.avatarUrl);
    setAvatarCropPreview(profile.avatarCropUrl);
  }, [profile]);

  if (isLoading || !profile) return <p className="text-sm text-ink-muted">Đang tải hồ sơ…</p>;

  const pickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return toast.error('Chỉ nhận ảnh tối đa 5 MB.');
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setCropCandidate({ file, sourceUrl: URL.createObjectURL(file), shape: 'portrait' });
    event.target.value = '';
  };
  const closeCrop = () => {
    if (cropCandidate?.sourceUrl.startsWith('blob:')) URL.revokeObjectURL(cropCandidate.sourceUrl);
    setCropCandidate(null);
  };
  const confirmCrop = async (cropFile: File) => {
    if (!cropCandidate) return;
    if (cropCandidate.shape === 'portrait') {
      setAvatarPortraitFile(cropFile);
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(cropFile));
    } else {
      if (avatarCropPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarCropPreview);
      setAvatarCropFile(cropFile);
      setAvatarCropPreview(URL.createObjectURL(cropFile));
    }
    closeCrop();
  };
  const editAvatarCrop = (shape: 'circle' | 'portrait') => {
    const sourceFile = avatarFile ?? new File([], shape === 'portrait' ? 'portrait.jpg' : 'avatar.jpg');
    const sourceUrl = avatarFile
      ? URL.createObjectURL(avatarFile)
      : profile.avatarOriginalUrl ?? profile.avatarUrl ?? profile.employee?.photoUrl;
    if (sourceUrl) setCropCandidate({ file: sourceFile, sourceUrl, shape });
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const avatarKey = avatarFile ? await uploadMyAvatar(avatarFile) : undefined;
      const avatarPortraitKey = avatarPortraitFile ? await uploadMyAvatar(avatarPortraitFile) : undefined;
      const avatarCropKey = avatarCropFile ? await uploadMyAvatar(avatarCropFile) : undefined;
      const result = await update.mutateAsync({ avatarKey, avatarPortraitKey, avatarCropKey, ...(profile.employee ? { salaryBankName: salaryBankName.trim(), salaryBankAccount: salaryBankAccount.trim() } : {}) });
      queryClient.setQueryData(['my-profile'], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance', 'roster'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
      ]);
      const auth = useAuthStore.getState();
      if (auth.accessToken && auth.refreshToken && auth.user) auth.setAuth({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: { ...auth.user, avatarUrl: result.avatarUrl, avatarPortraitUrl: result.avatarUrl, avatarCropUrl: result.avatarCropUrl } });
      setAvatarFile(null);
      setAvatarPortraitFile(null);
      setAvatarCropFile(null);
      setAvatarPreview(result.avatarUrl);
      setAvatarCropPreview(result.avatarCropUrl);
      toast.success('Đã lưu cập nhật cá nhân');
    } catch { toast.error('Không thể lưu cập nhật. Vui lòng thử lại.'); }
  };
  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error('Mật khẩu mới cần ít nhất 8 ký tự.');
    if (newPassword !== confirmPassword) return toast.error('Xác nhận mật khẩu chưa khớp.');
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success('Đã đổi mật khẩu. Hãy đăng nhập lại để tiếp tục.');
      useAuthStore.getState().clear(); window.location.assign('/login');
    } catch { toast.error('Không thể đổi mật khẩu. Kiểm tra lại mật khẩu hiện tại.'); }
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <Dialog open={Boolean(cropCandidate)} onOpenChange={(open) => !open && closeCrop()}>{cropCandidate && <AvatarCropDialog file={cropCandidate.file} sourceUrl={cropCandidate.sourceUrl} shape={cropCandidate.shape} onCancel={closeCrop} onConfirm={confirmCrop} />}</Dialog>
    <div><h1 className="text-2xl font-bold tracking-tight">Cài đặt tài khoản</h1></div>
    <section className="rounded-card border border-border bg-card p-5"><div className="flex items-center gap-2"><UserRound className="size-5 text-purple-700" /><h2 className="font-semibold">Cập nhật cá nhân</h2></div><form onSubmit={saveProfile} className="mt-5 space-y-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-end"><div className="flex shrink-0 flex-col items-center gap-2"><button type="button" onClick={() => fileRef.current?.click()} className="relative flex h-36 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-ink bg-canvas text-xl font-bold text-purple-700">{avatarPreview ? <img src={avatarPreview} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : <><Camera className="size-8 text-ink-muted" /><span className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-emerald-500 text-xl text-white">+</span></>}<span className="sr-only">Đổi ảnh đại diện</span></button><div className="flex items-center gap-2"><Button type="button" size="sm" variant="secondary" disabled={!avatarFile && !profile.avatarOriginalUrl && !profile.avatarUrl} onClick={() => editAvatarCrop('portrait')}><Crop className="size-4" />C&#259;n &#7843;nh ch&#226;n dung</Button><Button type="button" size="sm" variant="secondary" disabled={!avatarFile && !profile.avatarOriginalUrl && !profile.avatarUrl} onClick={() => editAvatarCrop('circle')}><Crop className="size-4" />T&#7841;o icon</Button>{avatarCropPreview && <img src={avatarCropPreview} alt="Icon tr&#242;n" className="size-10 rounded-full object-cover" />}</div></div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickAvatar} className="hidden" />{profile.employee && <div className="grid flex-1 gap-4 sm:grid-cols-2"><Field label="Ngân hàng"><input value={salaryBankName} onChange={(e) => setSalaryBankName(e.target.value)} placeholder="VD: Vietcombank" className="input" /></Field><Field label="STK nhận lương"><input value={salaryBankAccount} onChange={(e) => setSalaryBankAccount(e.target.value)} inputMode="numeric" placeholder="0123456789" className="input" /></Field></div>}</div><Button disabled={update.isPending} type="submit"><Save />{update.isPending ? 'Đang lưu…' : 'Lưu'}</Button></form></section>
    <section className="rounded-card border border-border bg-card p-5"><div className="flex items-center gap-2"><KeyRound className="size-5 text-amber-600" /><h2 className="font-semibold">Đổi mật khẩu</h2></div><form onSubmit={savePassword} className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Mật khẩu hiện tại"><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="input" /></Field><Field label="Mật khẩu mới"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required className="input" /></Field><Field label="Xác nhận mật khẩu"><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required className="input" /></Field><div className="sm:col-span-3"><Button type="submit" disabled={changePassword.isPending}><ShieldCheck />{changePassword.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}</Button></div></form></section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
