import { isoDateInTimeZone, minutesInTimeZone, monthStartInTimeZone, workDateInTimeZone } from './company-time';

describe('company timezone helpers', () => {
  const vietnam = 'Asia/Ho_Chi_Minh';

  it('uses the company date across the UTC midnight boundary', () => {
    const at = new Date('2026-11-20T18:30:00.000Z'); // 01:30 on 21 Nov in Vietnam
    expect(isoDateInTimeZone(at, vietnam)).toBe('2026-11-21');
    expect(workDateInTimeZone(at, vietnam).toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('derives local schedule minutes and month boundary from the company zone', () => {
    const at = new Date('2026-12-31T17:15:00.000Z'); // 00:15 on 1 Jan in Vietnam
    expect(minutesInTimeZone(at, vietnam)).toBe(15);
    expect(monthStartInTimeZone(at, vietnam).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
