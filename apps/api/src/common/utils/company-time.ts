/**
 * Dates are persisted as UTC, while a work date belongs to the company's
 * configured IANA timezone. Keep this conversion in one place so midnight
 * does not split a Vietnamese workday when the server runs in another zone.
 */
export function zonedDateParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

export function workDateInTimeZone(at: Date, timeZone: string) {
  const { year, month, day } = zonedDateParts(at, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isoDateInTimeZone(at: Date, timeZone: string) {
  const { year, month, day } = zonedDateParts(at, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function minutesInTimeZone(at: Date, timeZone: string) {
  const { hour, minute } = zonedDateParts(at, timeZone);
  return hour * 60 + minute;
}

export function monthStartInTimeZone(at: Date, timeZone: string) {
  const { year, month } = zonedDateParts(at, timeZone);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Converts a YYYY-MM-DD company work date to the database's UTC date-only representation. */
export function workDateFromIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid work date');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
