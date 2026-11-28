"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { useEmployees } from "@/features/employees/api";
import { useBranches, useWorkSchedules } from "@/features/settings/api";
import { useApplyWorkScheduleRange, useBulkDeleteWorkRoster, useCopyWorkRosterDay, useGenerateWorkRoster, useUpdateDailySchedule, useWorkRoster, type RosterEntry } from "@/features/attendance/work-roster-api";
import { employeeDateMarker } from "@/features/employees/employee-date-marker";

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const initials = (name: string) => name.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
const datesInRange = (fromDate: string, toDate: string) => {
  if (!fromDate || !toDate || fromDate > toDate) return [];
  const cursor = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  const dates: string[] = [];
  while (cursor <= end && dates.length <= 31) {
    dates.push(dateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export default function KalenderPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [branchId, setBranchId] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [deletingEntry, setDeletingEntry] = useState<RosterEntry | null>(null);
  const [editing, setEditing] = useState<RosterEntry>();
  const [copyingDate, setCopyingDate] = useState<string>();
  const [addingShiftDate, setAddingShiftDate] = useState<string>();
  const month = monthKey(cursor);
  const { data: roster, isLoading } = useWorkRoster(month);
  const canManage = useAuthStore((state) => state.hasPermission("attendance-policy:update"));
  const generate = useGenerateWorkRoster(month);
  const { data: employees } = useEmployees({ pageSize: 100, sortBy: "fullName", sortOrder: "asc" });
  const { data: branchOptions } = useBranches(canManage);
  const { data: schedules } = useWorkSchedules(canManage);
  const updateDay = useUpdateDailySchedule(month);
  const applyRange = useApplyWorkScheduleRange();
  const bulkDelete = useBulkDeleteWorkRoster();
  const copyDay = useCopyWorkRosterDay();
  const [creatingRange, setCreatingRange] = useState(false);
  const [selectingDays, setSelectingDays] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [copySource, setCopySource] = useState<string>();
  const [employeeFilterId, setEmployeeFilterId] = useState("");
  const [mobileSelectedDate, setMobileSelectedDate] = useState(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const currentMonth = monthKey(today);
  useEffect(() => {
    if (!mobileSelectedDate.startsWith(month)) setMobileSelectedDate(`${month}-01`);
  }, [mobileSelectedDate, month]);
  const branches = branchOptions?.filter((branch) => branch.isActive) ?? roster?.branches ?? [];
  const activeBranch = branchId ?? branches[0]?.id;
  const entries = useMemo(() => (roster?.entries ?? []).filter((entry) =>
    (!activeBranch || entry.segments.some((segment) => segment.branch.id === activeBranch))
    && (!employeeFilterId || entry.employee.id === employeeFilterId)
  ), [activeBranch, employeeFilterId, roster?.entries]);
  const filteredEmployee = employees?.items.find((employee) => employee.id === employeeFilterId);
  const byDate = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    entries.forEach((entry) => { const key = entry.workDate.slice(0, 10); map.set(key, [...(map.get(key) ?? []), entry]); });
    return map;
  }, [entries]);
  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const selectedEntries = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const mobileSelectedEntries = byDate.get(mobileSelectedDate) ?? [];
  const partTimeEntries = selectedEntries.filter((entry) => entry.employee.employmentType === "PART_TIME");
  const fullTimeEntries = selectedEntries.filter((entry) => entry.employee.employmentType === "FULL_TIME");
  const toggleCalendarDate = (key: string) => {
    if (!selectingDays && !copySource) {
      if (window.matchMedia("(max-width: 639px)").matches) {
        setMobileSelectedDate(key);
        setSelectedDate(undefined);
      } else {
        setSelectedDate(key);
      }
      return;
    }
    setSelectedDays((current) => current.includes(key) ? current.filter((date) => date !== key) : [...current, key].sort());
  };
  const clearDaySelection = () => {
    setSelectedDays([]);
    setSelectingDays(false);
    setCopySource(undefined);
  };
  const startCopy = () => {
    if (selectedDays.length !== 1) return;
    setCopySource(selectedDays[0]);
    setSelectedDays([]);
  };
  const applyCopy = () => {
    if (!copySource || !activeBranch || !selectedDays.length) return;
    copyDay.mutate({ sourceDate: copySource, targetDates: selectedDays, branchId: activeBranch }, { onSuccess: clearDaySelection });
  };
  const deleteSelectedShifts = () => {
    if (!activeBranch || !selectedDays.length) return;
    const scope = filteredEmployee ? `ca của ${filteredEmployee.fullName}` : "toàn bộ ca thuộc chi nhánh đang chọn";
    if (!window.confirm(`Xóa ${scope} trong ${selectedDays.length} ngày? Không thể hoàn tác thao tác này.`)) return;
    bulkDelete.mutate({ workDates: selectedDays, branchId: activeBranch, employeeId: employeeFilterId || undefined }, { onSuccess: clearDaySelection });
  };
  const selectAllDays = () => {
    setSelectedDays(cells.filter((day): day is number => day !== null).map((day) => dateKey(year, monthIndex, day)));
  };
  const openCopyDialog = () => {
    if (!selectedDate) return;
    const sourceDate = selectedDate;
    setSelectedDate(undefined);
    window.setTimeout(() => setCopyingDate(sourceDate), 0);
  };
  const openAddShiftDialog = () => {
    if (!selectedDate) return;
    const workDate = selectedDate;
    setSelectedDate(undefined);
    window.setTimeout(() => setAddingShiftDate(workDate), 0);
  };
  const removeSelectedEntry = () => {
    if (!deletingEntry) return;
    const branchId = deletingEntry.segments[0]?.branch.id;
    if (!branchId) return;
    bulkDelete.mutate({
      workDates: [deletingEntry.workDate.slice(0, 10)],
      branchId,
      employeeId: deletingEntry.employee.id,
    }, { onSuccess: () => setDeletingEntry(null) });
  };
  const renderShiftEntry = (entry: RosterEntry) => (
    <div key={entry.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 border border-border sm:size-12">
          <AvatarImage src={entry.employee.avatarUrl ?? entry.employee.photoUrl ?? undefined} alt={entry.employee.fullName} />
          <AvatarFallback className="text-xs font-semibold">{initials(entry.employee.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate font-medium">{entry.employee.fullName}</div>
          <div className="truncate text-xs text-ink-muted">{entry.scheduleName} · {entry.segments.map((segment) => `${segment.startTime}–${segment.endTime} (${segment.branch.name})`).join(" · ")}</div>
        </div>
      </div>
      {canManage && <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" className="min-h-10" onClick={() => { setEditing(entry); setSelectedDate(undefined); }}>Sửa</Button>
        <Button type="button" size="icon" variant="ghost" className="min-h-10 min-w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Loại bỏ ca của ${entry.employee.fullName}`} title="Loại bỏ ca" onClick={() => setDeletingEntry(entry)}><X /></Button>
      </div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Lịch làm việc" />
      <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <Button variant="secondary" size="icon" className="min-h-11 min-w-11 [&_svg]:size-4" aria-label="Tháng trước" onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}><ChevronLeft /></Button>
            <h3 className="min-w-0 flex-1 text-center text-base font-medium capitalize">{cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</h3>
            <Button variant="secondary" size="icon" className="min-h-11 min-w-11 [&_svg]:size-4" aria-label="Tháng sau" onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}><ChevronRight /></Button>
          </div>
          <div className="mt-2 flex items-center gap-2 sm:hidden">
            {canManage && <Button className="min-h-11 flex-1" variant="secondary" onClick={() => setCreatingRange(true)}><Plus className="size-4" />Tạo lịch</Button>}
            {(canManage || month !== currentMonth) && <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="min-h-11 min-w-11" aria-label="Thao tác lịch"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && <>
                  <DropdownMenuItem onSelect={() => { setSelectingDays((value) => !value); setSelectedDays([]); setCopySource(undefined); }}>Chọn nhiều ngày</DropdownMenuItem>
                  <DropdownMenuItem disabled={generate.isPending} onSelect={() => generate.mutate()}>{generate.isPending ? "Đang xếp ca…" : "Tự động xếp ca"}</DropdownMenuItem>
                </>}
                {month !== currentMonth && <DropdownMenuItem onSelect={() => { setCursor(new Date()); clearDaySelection(); }}>Về tháng hiện tại</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
          <div className="hidden items-center justify-between gap-3 sm:flex">
            <h3 className="text-base font-medium capitalize">{cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManage && <><Button size="sm" variant="secondary" onClick={() => setCreatingRange(true)}>Tạo Lịch</Button><Button size="sm" variant="secondary" onClick={() => { setSelectingDays((value) => !value); setSelectedDays([]); setCopySource(undefined); }}>Chọn nhiều</Button><Button size="sm" variant="secondary" title="Tự động thêm các ca còn trống từ phân công ca định kỳ của nhân viên" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? "Đang xếp ca…" : "Tự động xếp ca"}</Button></>}
              {month !== currentMonth && <Button variant="secondary" size="sm" onClick={() => { setCursor(new Date()); clearDaySelection(); }}>Về tháng hiện tại</Button>}
              <Button variant="secondary" size="icon" aria-label="Tháng trước" onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}><ChevronLeft /></Button><Button variant="secondary" size="icon" aria-label="Tháng sau" onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}><ChevronRight /></Button>
            </div>
          </div>
        </div>
        <div className="mb-4 flex min-w-0 flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:flex-wrap sm:items-center">
          {branches.length > 0 ? <>
            <Select className="h-11 w-full sm:hidden" aria-label="Chi nhánh" value={activeBranch ?? ""} onChange={(event) => setBranchId(event.target.value)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
            <div className="hidden min-w-0 flex-1 flex-wrap gap-2 sm:flex">{branches.map((branch) => <button key={branch.id} type="button" onClick={() => setBranchId(branch.id)} className={`rounded-lg px-3 py-2 text-sm ${activeBranch === branch.id ? "bg-ink text-white" : "bg-canvas text-ink-muted"}`}>{branch.name}</button>)}</div>
          </> : <span className="py-2 text-sm text-ink-muted">Chưa có dữ liệu lịch cho tháng này.</span>}
          <label className="w-full shrink-0 sm:w-72"><span className="sr-only">Lọc nhân viên</span><EmployeeCombobox value={employeeFilterId} branchId={activeBranch ?? ""} branchName={branches.find((branch) => branch.id === activeBranch)?.name} onChange={(employeeId) => { setEmployeeFilterId(employeeId); if (!employeeId) clearDaySelection(); }} allowClear /></label>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-ink-subtle sm:gap-1 sm:text-xs">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <div key={day} className="py-1">{day}</div>)}</div>
        {canManage && (selectingDays || copySource) && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-3 text-sm"><span className="mr-auto">{copySource ? `Ngày nguồn: ${copySource} · Chọn ngày đích (${selectedDays.length})` : `Đã chọn ${selectedDays.length} ngày`}</span>{copySource ? <><Button size="sm" disabled={!selectedDays.length || copyDay.isPending} onClick={applyCopy}>Sao chép vào ngày đã chọn</Button><Button size="sm" variant="secondary" onClick={clearDaySelection}>Hủy</Button></> : <><Button size="sm" variant="secondary" onClick={selectAllDays}>Chọn Tất cả</Button>{selectedDays.length === 1 && <Button size="sm" variant="secondary" onClick={startCopy}>Sao chép lịch ngày này</Button>}{selectedDays.length > 0 && <Button size="sm" variant="secondary" disabled={bulkDelete.isPending} onClick={deleteSelectedShifts}>Xóa</Button>}<Button size="sm" variant="secondary" onClick={clearDaySelection}>Bỏ chọn</Button></>}</div>}
        <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((day, index) => {
            if (!day) return <div key={`blank-${index}`} className="aspect-square min-h-0 rounded-lg bg-canvas/40 sm:aspect-auto sm:min-h-32" />;
            const key = dateKey(year, monthIndex, day);
            const dayEntries = byDate.get(key) ?? [];
            const isSelected = selectedDays.includes(key);
            const isCopySource = copySource === key;
            const isToday = key === todayKey;
            return (
              <button
                type="button"
                key={key}
                aria-label={`${day} ${cursor.toLocaleDateString("vi-VN", { month: "long" })}, ${dayEntries.length} ca`}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelected || isCopySource}
                onClick={() => toggleCalendarDate(key)}
                className={`flex aspect-square min-h-0 flex-col overflow-hidden rounded-lg border p-1 text-left hover:border-accent-purple/60 sm:aspect-auto sm:min-h-32 sm:block sm:p-2 ${isSelected || isCopySource ? "border-ink bg-accent-purple/10 ring-2 ring-ink/20" : isToday ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200" : "border-border bg-card"}`}
              >
                <div className="flex w-full items-center justify-between gap-0.5 text-[11px] font-medium text-ink-subtle sm:mb-2 sm:gap-1 sm:text-xs">
                  {isSelected ? <span className="rounded-full bg-ink px-1 text-white">✓</span> : isCopySource ? <span className="hidden rounded-full bg-accent-purple/20 px-1.5 py-0.5 text-purple-900 sm:inline">Nguồn</span> : <span />}
                  <span className={isToday ? "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 font-semibold text-white" : "inline-flex size-6 shrink-0 items-center justify-center"}>{day}</span>
                </div>
                {dayEntries.length > 0 && <span className="mt-auto inline-flex min-h-5 min-w-5 max-w-full items-center justify-center self-start rounded-full bg-accent-purple/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-purple-900 sm:hidden">{dayEntries.length > 9 ? "9+" : dayEntries.length}</span>}
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                  {dayEntries.slice(0, 10).map((entry) => {
                    const marker = employeeDateMarker(entry.employee.joinDate, entry.employee.exitDate);
                    return <span key={entry.id} className="relative inline-flex shrink-0" title={`${entry.employee.fullName} · ${entry.scheduleName}`}>
                      <Avatar className="size-10 border-2 border-white bg-card shadow-sm">
                        <AvatarImage src={entry.employee.avatarUrl ?? entry.employee.photoUrl ?? undefined} alt={entry.employee.fullName} />
                        <AvatarFallback className="text-[10px] font-semibold">{initials(entry.employee.fullName)}</AvatarFallback>
                      </Avatar>
                      {marker && <span className={`absolute -right-1 -top-1 z-10 inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold ${marker.tone === "rose" ? "bg-rose-200 text-rose-800" : "bg-amber-100 text-amber-900"}`} title={marker.title}>{marker.value}</span>}
                    </span>;
                  })}
                  {dayEntries.length > 10 && <span className="inline-flex size-10 items-center justify-center rounded-full bg-canvas text-[10px]">+{dayEntries.length - 10}</span>}
                </div>
              </button>
            );
          })}
        </div>        <section className="mt-4 space-y-2 border-t border-border pt-3 sm:hidden" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h4 className="min-w-0 truncate text-sm font-semibold capitalize">{new Date(`${mobileSelectedDate}T12:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</h4>
            {canManage && <div className="flex shrink-0 gap-2"><Button size="icon" variant="secondary" className="min-h-11 min-w-11" aria-label="Sao chép lịch ngày này" title="Sao chép lịch" disabled={!mobileSelectedEntries.length} onClick={() => setCopyingDate(mobileSelectedDate)}><Copy className="size-4" /></Button><Button size="icon" className="min-h-11 min-w-11" aria-label="Thêm ca ngày này" title="Thêm ca" onClick={() => setAddingShiftDate(mobileSelectedDate)}><Plus className="size-4" /></Button></div>}
          </div>
          {mobileSelectedEntries.length ? <div className="space-y-2">{mobileSelectedEntries.map(renderShiftEntry)}</div> : <p className="rounded-xl bg-canvas p-3 text-sm text-ink-muted">Chưa có ca trong ngày này.</p>}
        </section>        {isLoading && <p className="mt-3 text-sm text-ink-muted">Đang tải lịch…</p>}
      </section>
      <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(undefined)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto p-6">
          <DialogTitle>Nhân viên ngày {selectedDate}</DialogTitle>
          <DialogDescription>Danh sách ca tại cửa hàng đang chọn.</DialogDescription>
          {canManage && <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={!selectedEntries.length} onClick={openCopyDialog}><Copy />Copy ngày</Button>
            <Button size="sm" onClick={openAddShiftDialog}><Plus />Thêm ca</Button>
          </div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-ink">Part Time</h3>
              {partTimeEntries.map(renderShiftEntry)}
              {!partTimeEntries.length && <p className="rounded-xl bg-canvas p-4 text-sm text-ink-muted">Không có nhân viên Part Time.</p>}
            </section>
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-ink">Full Time</h3>
              {fullTimeEntries.map(renderShiftEntry)}
              {!fullTimeEntries.length && <p className="rounded-xl bg-canvas p-4 text-sm text-ink-muted">Không có nhân viên Full Time.</p>}
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={Boolean(deletingEntry)}
        title="Xác nhận loại bỏ ca"
        description={`Loại bỏ ca “${deletingEntry?.scheduleName ?? ""}” của ${deletingEntry?.employee.fullName ?? "nhân viên"} ngày ${deletingEntry?.workDate.slice(0, 10) ?? ""}?`}
        pending={bulkDelete.isPending}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        onConfirm={removeSelectedEntry}
      />
      <Dialog open={Boolean(copyingDate)} onOpenChange={(open) => !open && setCopyingDate(undefined)}>{copyingDate && activeBranch && <CopyDayDialog sourceDate={copyingDate} pending={copyDay.isPending} onSave={(targetDates) => copyDay.mutate({ sourceDate: copyingDate, targetDates, branchId: activeBranch }, { onSuccess: () => setCopyingDate(undefined) })} onClose={() => setCopyingDate(undefined)} />}</Dialog>
      <Dialog open={Boolean(addingShiftDate)} onOpenChange={(open) => !open && setAddingShiftDate(undefined)}>{addingShiftDate && <AddShiftDialog workDate={addingShiftDate} schedules={schedules ?? []} branches={branches} preferredBranchId={activeBranch} pending={updateDay.isPending} onSave={(payload) => updateDay.mutate(payload, { onSuccess: () => setAddingShiftDate(undefined) })} onClose={() => setAddingShiftDate(undefined)} />}</Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(undefined)}>{editing && <EditDayDialog entry={editing} schedules={schedules ?? []} branches={branches} employees={employees?.items ?? []} pending={updateDay.isPending} onSave={(payload) => updateDay.mutate(payload, { onSuccess: () => setEditing(undefined) })} onClose={() => setEditing(undefined)} />}</Dialog>
      <Dialog open={creatingRange} onOpenChange={setCreatingRange}>{creatingRange && <CreateRangeDialog schedules={schedules ?? []} branches={branches} preferredBranchId={activeBranch} pending={applyRange.isPending} onSave={(payload) => applyRange.mutate(payload, { onSuccess: () => setCreatingRange(false) })} onClose={() => setCreatingRange(false)} />}</Dialog>
    </div>
  );
}

function CreateRangeDialog({ schedules, branches, preferredBranchId, pending, onSave, onClose }: {
  schedules: Array<{ id: string; name: string; startTime: string; endTime: string; secondStartTime?: string | null; secondEndTime?: string | null }>;
  branches: Array<{ id: string; name: string }>;
  preferredBranchId?: string;
  pending: boolean;
  onSave: (payload: { employeeId: string; fromDate: string; toDate: string; workScheduleId: string; branchIds: string[] }) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState(preferredBranchId ?? branches[0]?.id ?? "");
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  useEffect(() => {
    if (!branchId && (preferredBranchId || branches[0]?.id)) setBranchId(preferredBranchId ?? branches[0].id);
    if (!scheduleId && schedules[0]?.id) setScheduleId(schedules[0].id);
  }, [branchId, branches, preferredBranchId, scheduleId, schedules]);
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const schedule = schedules.find((item) => item.id === scheduleId);
  const segmentCount = schedule?.secondStartTime && schedule.secondEndTime ? 2 : 1;
  const isValidRange = Boolean(employeeId && branchId && scheduleId && fromDate && toDate && fromDate <= toDate);

  return (
    <DialogContent className="p-6">
      <DialogTitle>Tạo lịch làm việc</DialogTitle>
      <DialogDescription>
        Áp dụng cho từng ngày trong khoảng đã chọn, bao gồm cả ngày bắt đầu và kết thúc. Ca mới thay ca khác trong cùng ngày;
        nếu đã đúng ca thì giữ nguyên.
      </DialogDescription>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          Nhân viên
          <EmployeeCombobox value={employeeId} branchId={branchId} branchName={selectedBranch?.name} onChange={setEmployeeId} />
        </label>
        <label className="block text-sm">
          Chi nhánh
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </label>
        <label className="block text-sm">
          Ca làm
          <Select value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>
            {schedules.map((item) => <option key={item.id} value={item.id}>
              {item.name} · {item.startTime}–{item.endTime}{item.secondStartTime ? ` · ${item.secondStartTime}–${item.secondEndTime}` : ""}
            </option>)}
          </Select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">Từ ngày<input className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="block text-sm">Đến ngày<input className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>
        {segmentCount === 2 && <p className="text-xs text-ink-muted">Ca gãy có hai khung giờ; cả hai khung được xếp tại {selectedBranch?.name ?? "chi nhánh đã chọn"}.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={pending || !isValidRange} onClick={() => onSave({
            employeeId,
            fromDate,
            toDate,
            workScheduleId: scheduleId,
            branchIds: Array.from({ length: segmentCount }, () => branchId),
          })}>Tạo Lịch</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function EmployeeCombobox({ value, branchId, branchName, onChange, allowClear = false }: {
  value: string;
  branchId: string;
  branchName?: string;
  onChange: (employeeId: string) => void;
  allowClear?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);
  const searchTerm = value ? query.split(" · ")[0] : query;
  const { data: employeeResult, isFetching } = useEmployees({ pageSize: 100, search: searchTerm, sortBy: "fullName", sortOrder: "asc" });
  const employees = [...(employeeResult?.items ?? [])].sort((a, b) => {
    const aPriority = a.primaryBranch?.id === branchId ? 0 : 1;
    const bPriority = b.primaryBranch?.id === branchId ? 0 : 1;
    return aPriority - bPriority || a.fullName.localeCompare(b.fullName, "vi");
  });
  const preferredEmployees = employees.filter((employee) => employee.primaryBranch?.id === branchId);
  const otherEmployees = employees.filter((employee) => employee.primaryBranch?.id !== branchId);
  const chooseEmployee = (employee: (typeof employees)[number]) => {
    onChange(employee.id);
    setQuery(`${employee.fullName} · ${employee.employeeNo}`);
    setOpen(false);
  };

  return (
    <div className="relative mt-1" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <input
        className={`h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/30 ${allowClear && value ? "pr-10" : ""}`}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        autoComplete="off"
        value={query}
        placeholder="Chọn hoặc tìm theo tên, mã nhân viên"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (value) onChange("");
          setOpen(true);
        }}
      />
      {allowClear && value && <button type="button" aria-label="Bỏ lọc nhân viên" title="Bỏ lọc" className="absolute right-2 top-1.5 inline-flex size-6 items-center justify-center rounded-full text-ink-muted hover:bg-canvas hover:text-ink" onClick={() => { onChange(""); setOpen(false); }}><X className="size-4" /></button>}
      {open && (
        <div id={listboxId} role="listbox" className="absolute z-[60] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card-hover">
          {isFetching && <p className="px-3 py-2 text-xs text-ink-muted">Đang tìm nhân viên…</p>}
          {!isFetching && employees.length === 0 && <p className="px-3 py-3 text-sm text-ink-muted">Không tìm thấy nhân viên.</p>}
          {preferredEmployees.length > 0 && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Chi nhánh {branchName ?? "đang chọn"}</p>}
          {preferredEmployees.map((employee) => <button key={employee.id} type="button" role="option" aria-selected={value === employee.id} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas ${value === employee.id ? "bg-canvas font-medium" : ""}`} onClick={() => chooseEmployee(employee)}><span className="block text-ink">{employee.fullName}</span><span className="block text-xs text-ink-muted">{employee.employeeNo}</span></button>)}
          {otherEmployees.length > 0 && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Các chi nhánh khác</p>}
          {otherEmployees.map((employee) => <button key={employee.id} type="button" role="option" aria-selected={value === employee.id} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas ${value === employee.id ? "bg-canvas font-medium" : ""}`} onClick={() => chooseEmployee(employee)}><span className="block text-ink">{employee.fullName}</span><span className="block text-xs text-ink-muted">{employee.primaryBranch?.name ?? "Chưa gắn chi nhánh"} · {employee.employeeNo}</span></button>)}
        </div>
      )}
    </div>
  );
}

function CopyDayDialog({ sourceDate, pending, onSave, onClose }: {
  sourceDate: string;
  pending: boolean;
  onSave: (targetDates: string[]) => void;
  onClose: () => void;
}) {
  const nextDate = new Date(`${sourceDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const defaultTarget = dateKey(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  const [fromDate, setFromDate] = useState(defaultTarget);
  const [toDate, setToDate] = useState(defaultTarget);
  const range = datesInRange(fromDate, toDate);
  const targetDates = range.filter((date) => date !== sourceDate);
  const rangeTooLong = range.length > 31;
  const canCopy = targetDates.length > 0 && !rangeTooLong;

  return (
    <DialogContent className="p-6">
      <DialogTitle>Copy ngày {sourceDate}</DialogTitle>
      <DialogDescription>
        Sao chép toàn bộ ca của chi nhánh đang xem sang từng ngày trong khoảng. Lịch của cùng nhân viên tại ngày đích sẽ được ghi đè.
      </DialogDescription>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">Từ ngày<input className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="block text-sm">Đến ngày<input className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>
        {fromDate > toDate && <p className="text-xs text-red-600">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}
        {rangeTooLong && <p className="text-xs text-red-600">Mỗi lần chỉ được sao chép tối đa 31 ngày.</p>}
        {!rangeTooLong && fromDate <= toDate && <p className="text-xs text-ink-muted">Sẽ sao chép sang {targetDates.length} ngày{range.includes(sourceDate) ? "; ngày nguồn được tự động bỏ qua" : ""}.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={pending || !canCopy} onClick={() => onSave(targetDates)}>Copy khoảng ngày</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function AddShiftDialog({ workDate, schedules, branches, preferredBranchId, pending, onSave, onClose }: {
  workDate: string;
  schedules: Array<{ id: string; name: string; startTime: string; endTime: string; secondStartTime?: string | null; secondEndTime?: string | null }>;
  branches: Array<{ id: string; name: string }>;
  preferredBranchId?: string;
  pending: boolean;
  onSave: (payload: { employeeId: string; workDate: string; workScheduleId: string; branchIds: string[] }) => void;
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState(preferredBranchId ?? branches[0]?.id ?? "");
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id ?? "");

  useEffect(() => {
    if (!branchId && (preferredBranchId || branches[0]?.id)) setBranchId(preferredBranchId ?? branches[0].id);
    if (!scheduleId && schedules[0]?.id) setScheduleId(schedules[0].id);
  }, [branchId, branches, preferredBranchId, scheduleId, schedules]);

  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const schedule = schedules.find((item) => item.id === scheduleId);
  const segmentCount = schedule?.secondStartTime && schedule.secondEndTime ? 2 : 1;
  const canSave = Boolean(employeeId && branchId && scheduleId);

  return (
    <DialogContent className="p-6">
      <DialogTitle>Thêm ca ngày {workDate}</DialogTitle>
      <DialogDescription>Chọn nhân viên và ca làm. Nếu nhân viên đã có lịch trong ngày này, ca mới sẽ thay ca cũ.</DialogDescription>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          Nhân viên
          <EmployeeCombobox value={employeeId} branchId={branchId} branchName={selectedBranch?.name} onChange={setEmployeeId} />
        </label>
        <label className="block text-sm">
          Chi nhánh
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </label>
        <label className="block text-sm">
          Ca làm
          <Select value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>
            {schedules.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.startTime}–{item.endTime}{item.secondStartTime ? ` · ${item.secondStartTime}–${item.secondEndTime}` : ""}</option>)}
          </Select>
        </label>
        {segmentCount === 2 && <p className="text-xs text-ink-muted">Cả hai khung của ca gãy được xếp tại {selectedBranch?.name ?? "chi nhánh đã chọn"}.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={pending || !canSave} onClick={() => onSave({ employeeId, workDate, workScheduleId: scheduleId, branchIds: Array.from({ length: segmentCount }, () => branchId) })}>Thêm ca</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function EditDayDialog({ entry, schedules, branches, employees, pending, onSave, onClose }: { entry: RosterEntry; schedules: Array<{ id: string; name: string; startTime: string; endTime: string; secondStartTime?: string | null; secondEndTime?: string | null }>; branches: Array<{ id: string; name: string }>; employees: Array<{ id: string; fullName: string }>; pending: boolean; onSave: (payload: { employeeId: string; workDate: string; workScheduleId: string; branchIds: string[] }) => void; onClose: () => void }) {
  const [employeeId, setEmployeeId] = useState(entry.employee.id); const [scheduleId, setScheduleId] = useState(entry.workScheduleId); const [branchIds, setBranchIds] = useState(entry.segments.map((segment) => segment.branch.id)); const schedule = schedules.find((item) => item.id === scheduleId); const segmentCount = schedule?.secondStartTime && schedule.secondEndTime ? 2 : 1;
  return <DialogContent className="p-6"><DialogTitle>Sửa lịch ngày {entry.workDate.slice(0, 10)}</DialogTitle><DialogDescription>Chọn một mẫu ca; ca gãy tự có hai khung giờ.</DialogDescription><div className="mt-4 space-y-3"><label className="block text-sm">Nhân viên<Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</Select></label><label className="block text-sm">Mẫu ca<Select value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setBranchIds((current) => current.slice(0, 1)); }}>{schedules.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.startTime}–{item.endTime}{item.secondStartTime ? ` · ${item.secondStartTime}–${item.secondEndTime}` : ""}</option>)}</Select></label>{Array.from({ length: segmentCount }, (_, index) => <label className="block text-sm" key={index}>Cửa hàng khung {index + 1}<Select value={branchIds[index] ?? branches[0]?.id ?? ""} onChange={(event) => setBranchIds((current) => { const next = [...current]; next[index] = event.target.value; return next; })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>)}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={pending || branchIds.length < segmentCount} onClick={() => onSave({ employeeId, workDate: entry.workDate.slice(0, 10), workScheduleId: scheduleId, branchIds: branchIds.slice(0, segmentCount) })}>Lưu</Button></div></div></DialogContent>;
}
