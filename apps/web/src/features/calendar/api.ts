'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export type CalendarEventType = 'deadline' | 'leave' | 'milestone' | 'holiday';

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  detail?: string;
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', from, to],
    queryFn: async () => (await api.get<CalendarEvent[]>('/calendar', { params: { from, to } })).data,
  });
}
