import { redirect } from "next/navigation";

/** Keeps bookmarked legacy detail URLs working by opening the shared dialog. */
export default async function AttendanceHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/absensi?mode=history&attendanceId=${encodeURIComponent(id)}`);
}
