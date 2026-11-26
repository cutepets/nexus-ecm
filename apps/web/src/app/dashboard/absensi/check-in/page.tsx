'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckInPage() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard/absensi/cham-cong'), [router]);
  return null;
}
