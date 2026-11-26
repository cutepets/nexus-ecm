import { redirect } from 'next/navigation';

/** Account administration now lives inside the employee profile. */
export default function TaiKhoanPage() {
  redirect('/dashboard/karyawan');
}
