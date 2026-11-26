import { BadRequestException } from '@nestjs/common';
import { WorkRosterService } from './work-roster.service';

describe('WorkRosterService.applyRange', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const storage = { presignedDownload: jest.fn(async (key: string) => `signed:${key}`) };

  beforeEach(() => audit.record.mockClear());

  it('adds missing days, replaces different shifts, and leaves matching shifts unchanged', async () => {
    const existingByDate = [
      { id: 'same', workScheduleId: 'schedule-a' },
      { id: 'different', workScheduleId: 'schedule-old' },
      null,
    ];
    const tx = {
      employeeDailySchedule: { findUnique: jest.fn().mockImplementation(async () => existingByDate.shift()) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);
    const upsertDay = jest.spyOn(service, 'upsertDay').mockResolvedValue({ id: 'written' } as never);

    const result = await service.applyRange({
      employeeId: 'employee-1',
      fromDate: '2026-11-24',
      toDate: '2026-11-26',
      workScheduleId: 'schedule-a',
      branchIds: ['branch-1'],
    }, { actorId: 'manager-1' });

    expect(result).toEqual({ fromDate: '2026-11-24', toDate: '2026-11-26', created: 1, replaced: 1, unchanged: 1 });
    expect(upsertDay).toHaveBeenCalledTimes(2);
    expect(upsertDay).toHaveBeenCalledWith(expect.anything(), 'employee-1', new Date('2026-11-25T00:00:00.000Z'), 'schedule-a', ['branch-1'], undefined, 'MANAGER_EDITED', 'manager-1');
    expect(upsertDay).toHaveBeenCalledWith(expect.anything(), 'employee-1', new Date('2026-11-26T00:00:00.000Z'), 'schedule-a', ['branch-1'], undefined, 'MANAGER_EDITED', 'manager-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'EmployeeDailyScheduleRange',
      entityId: 'employee-1',
      after: expect.objectContaining({ created: 1, replaced: 1, unchanged: 1 }),
    }));
  });

  it('rejects a reversed date range before writing anything', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);

    await expect(service.applyRange({
      employeeId: 'employee-1',
      fromDate: '2026-11-26',
      toDate: '2026-11-24',
      workScheduleId: 'schedule-a',
      branchIds: ['branch-1'],
    }, { actorId: 'manager-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('WorkRosterService bulk roster actions', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const storage = { presignedDownload: jest.fn(async (key: string) => `signed:${key}`) };

  it('deletes only schedules visible in the selected branch', async () => {
    const tx = {
      companySetting: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }) },
      employeeDailySchedule: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      workRosterMonth: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);

    const result = await service.bulkDelete({ workDates: ['2099-11-24', '2099-11-25'], branchId: 'branch-1' }, { actorId: 'manager-1' });

    expect(result).toEqual({ deleted: 2, days: 2 });
    expect(tx.employeeDailySchedule.deleteMany).toHaveBeenCalledWith({
      where: { workDate: { in: [new Date('2099-11-24T00:00:00.000Z'), new Date('2099-11-25T00:00:00.000Z')] }, segments: { some: { branchId: 'branch-1' } } },
    });
  });

  it('limits bulk deletion to the filtered employee when requested', async () => {
    const tx = {
      companySetting: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }) },
      employeeDailySchedule: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);

    await service.bulkDelete(
      { workDates: ['2099-11-24'], branchId: 'branch-1', employeeId: 'employee-1' },
      { actorId: 'manager-1' },
    );

    expect(tx.employeeDailySchedule.deleteMany).toHaveBeenCalledWith({
      where: {
        workDate: { in: [new Date('2099-11-24T00:00:00.000Z')] },
        employeeId: 'employee-1',
        segments: { some: { branchId: 'branch-1' } },
      },
    });
  });

  it('copies a source day to selected target days and counts replacements', async () => {
    const source = [{ employeeId: 'employee-1', workScheduleId: 'schedule-1', note: null, segments: [{ branchId: 'branch-1' }] }];
    const tx = {
      companySetting: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }) },
      employeeDailySchedule: {
        findMany: jest.fn().mockResolvedValue(source),
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      workRosterMonth: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);
    jest.spyOn(service, 'upsertDay').mockResolvedValue({ id: 'written' } as never);

    const result = await service.copyDay({ sourceDate: '2099-11-24', targetDates: ['2099-11-25', '2099-11-26'], branchId: 'branch-1' }, { actorId: 'manager-1' });

    expect(result).toEqual({ sourceDate: '2099-11-24', sourceEntries: 1, targetDays: 2, created: 1, replaced: 1 });
    expect(service.upsertDay).toHaveBeenCalledTimes(2);
  });

  it('allows administrators to change a future day in a legacy locked month', async () => {
    const tx = {
      companySetting: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }) },
      workRosterMonth: { upsert: jest.fn().mockResolvedValue({ id: 'month-1', status: 'LOCKED' }) },
      employeeDailySchedule: {
        findUnique: jest.fn().mockResolvedValue({ lockedAt: null }),
        upsert: jest.fn().mockResolvedValue({ id: 'day-1' }),
      },
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      workSchedule: { findUnique: jest.fn().mockResolvedValue({ id: 'schedule-1', name: 'Ca sáng', startTime: '08:00', endTime: '17:00', secondStartTime: null, secondEndTime: null }) },
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch-1' }]) },
    };
    const service = new WorkRosterService({} as never, audit as never, storage as never);

    await expect(service.upsertDay(tx as never, 'employee-1', new Date('2099-11-25T00:00:00.000Z'), 'schedule-1', ['branch-1'], undefined, 'MANAGER_EDITED', 'admin-1')).resolves.toEqual({ id: 'day-1' });
  });
});
