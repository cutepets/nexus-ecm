import { redirect } from "next/navigation";

/** Camera capture now opens only from the personal attendance dialog. */
export default function AttendancePunchPage() {
  redirect("/dashboard/absensi");
}
