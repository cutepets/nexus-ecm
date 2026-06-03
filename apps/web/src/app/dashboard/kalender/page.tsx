'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCalendar, type CalendarEvent, type CalendarEventType } from '@/features/calendar/api';

const TYPE_STYLE: Record<CalendarEventType, { dot: string; pill: string; label: string }> = {
  deadline: { dot: 'bg-pink-500', pill: 'bg-pink-100 text-pink-700', label: 'Deadline' },
  leave: { dot: 'bg-accent-purple', pill: 'bg-accent-purple/15 text-purple-700', label: 'Cuti' },
  milestone: { dot: 'bg-cyan-500', pill: 'bg-cyan-100 text-cyan-700', label: 'Milestone' },
  holiday: { dot: 'bg-red-500', pill: 'bg-red-100 text-red-700', label: 'Hari Libur' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function KalenderPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Fetch the visible month with a little padding so adjacent events show too.
  const from = ymd(year, month, 1);
  const to = ymd(year, month, new Date(year, month + 1, 0).getDate());
  const { data: events } = useCalendar(from, to);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events ?? []) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const { cells, monthLabel } = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number | null; date?: string; weekday?: number }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: ymd(year, month, d), weekday: new Date(year, month, d).getDay() });
    }
    return { cells, monthLabel: cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
  }, [cursor, year, month]);

  const todayStr = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className="space-y-6">
      <PageHeader title="Kalender" description="Acara, deadline, cuti, dan hari libur perusahaan" />

      <div className="rounded-card border border-border bg-card p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium capitalize">{monthLabel}</h3>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Hari Ini</Button>
            <Button variant="secondary" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft /></Button>
            <Button variant="secondary" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight /></Button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-muted">
          {Object.entries(TYPE_STYLE).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', v.dot)} /> {v.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-subtle">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            const dayEvents = cell.date ? byDate.get(cell.date) ?? [] : [];
            const isHoliday = dayEvents.some((e) => e.type === 'holiday');
            const isSunday = cell.weekday === 0;
            const isToday = cell.date === todayStr;
            return (
              <div
                key={i}
                className={cn(
                  'min-h-28 rounded-lg border p-1.5 text-left',
                  cell.day ? 'border-border bg-card' : 'border-transparent bg-canvas/40',
                  isToday && 'ring-2 ring-accent-purple/40',
                )}
              >
                {cell.day && (
                  <div className={cn('mb-1 text-xs font-medium', isHoliday || isSunday ? 'text-red-500' : 'text-ink-subtle')}>
                    {cell.day}
                  </div>
                )}
                <div className="space-y-1">
                  {dayEvents.map((e, idx) => (
                    <div
                      key={idx}
                      title={`${TYPE_STYLE[e.type].label}: ${e.title}${e.detail ? ` — ${e.detail}` : ''}`}
                      className={cn('flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px]', TYPE_STYLE[e.type].pill)}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', TYPE_STYLE[e.type].dot)} />
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-ink-subtle">Arahkan kursor (hover) ke sebuah acara untuk melihat detailnya.</p>
    </div>
  );
}
