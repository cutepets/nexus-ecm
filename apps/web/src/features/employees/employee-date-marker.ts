export type EmployeeDateMarker = { value: number; tone: 'amber' | 'rose'; title: string };

function dateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
}

export function employeeDateMarker(joinDate: string, exitDate?: string | null): EmployeeDateMarker | null {
  const today = dateOnly(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
  const join = dateOnly(joinDate);
  const exit = exitDate ? dateOnly(exitDate) : null;
  if (!today || !join) return null;

  if (exit && exit.getTime() >= today.getTime()) {
    return { value: Math.floor((exit.getTime() - today.getTime()) / 86_400_000), tone: 'rose', title: 'Số ngày đến ngày nghỉ việc' };
  }

  const end = exit && exit.getTime() < today.getTime() ? exit : today;
  if (end.getTime() < join.getTime()) return null;
  let months = (end.getUTCFullYear() - join.getUTCFullYear()) * 12 + end.getUTCMonth() - join.getUTCMonth();
  if (end.getUTCDate() < join.getUTCDate()) months -= 1;
  if (months !== 0) return null;
  return { value: Math.floor((end.getTime() - join.getTime()) / 86_400_000), tone: 'amber', title: 'Số ngày làm việc' };
}
