import { redirect } from "next/navigation";

/** Company-wide attendance history lives in the shared dialog shell. */
export default function AttendanceHistoryPage() {
  redirect("/dashboard/absensi?mode=history");
}
