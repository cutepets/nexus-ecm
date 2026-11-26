import { AttendanceService } from './attendance.service';
import { WorkRosterAutomationService } from './work-roster-automation.service';
import { WorkRosterService } from './work-roster.service';

describe('work roster integration flow', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const storage = { presignedDownload: jest.fn(async (key: string) => `signed:${key}`) };

  it('generates a split shift across two branches and lets a scheduled employee see that branch roster', async () => {
    const created: unknown[] = [];
    const roster = { id: 'roster-dec', status: 'DRAFT' };
    const prisma = {
      companySetting: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }) },
      workRosterMonth: {
        upsert: jest.fn().mockResolvedValue(roster),
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ ...roster, status: 'PUBLISHED' })
          .mockResolvedValueOnce({
            ...roster,
            status: 'PUBLISHED',
            dailySchedules: [
              {
                id: 'mine', workDate: new Date('2026-12-02'), workScheduleId: 'split', scheduleName: 'Ca gãy',
                employee: { id: 'employee-1', fullName: 'Nhân viên A', employeeNo: 'A-001', photoUrl: 'avatars/employee-1.jpg' },
                segments: [{ branch: { id: 'hn', code: 'HN', name: 'Hà Nội' } }],
              },
              {
                id: 'colleague', workDate: new Date('2026-12-02'), workScheduleId: 'normal', scheduleName: 'Ca thường',
                employee: { id: 'employee-2', fullName: 'Nhân viên B', employeeNo: 'B-001', photoUrl: null },
                segments: [{ branch: { id: 'hn', code: 'HN', name: 'Hà Nội' } }],
              },
            ],
          }),
      },
      employeeWorkScheduleAssignment: {
        findMany: jest.fn().mockResolvedValue([{
          employeeId: 'employee-1', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, weekdays: [2],
          employee: { primaryBranchId: 'hn', branchAssignments: [{ branchId: 'hcm' }] },
          workSchedule: { id: 'split', name: 'Ca gãy', startTime: '08:00', endTime: '13:00', secondStartTime: '17:00', secondEndTime: '22:00' },
        }]),
      },
      employeeDailySchedule: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ segments: [{ branchId: 'hn' }] }]),
        create: jest.fn(async ({ data }) => { created.push(data); return data; }),
      },
    };
    const service = new WorkRosterService(prisma as never, audit as never, storage as never);

    await service.generate('2026-12', { actorId: 'admin-1' });
    expect(created).toContainEqual(expect.objectContaining({
      segments: { create: [
        expect.objectContaining({ branchId: 'hn', sequence: 1 }),
        expect.objectContaining({ branchId: 'hcm', sequence: 2 }),
      ] },
    }));

    const visible = await service.list('2026-12', 'employee-1', false);
    expect(visible.branches).toEqual([{ id: 'hn', code: 'HN', name: 'Hà Nội' }]);
    expect(visible.entries.map((entry) => entry.employee.id)).toEqual(['employee-1', 'employee-2']);
    expect(visible.entries[0].employee.photoUrl).toBe('signed:avatars/employee-1.jpg');
  });

  it('automatically generates next month and locks only past published days', async () => {
    const prisma = {
      companySetting: { upsert: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh', rosterAutoGenerateEnabled: true, rosterGenerationDay: 20, rosterAutoLockEnabled: true }) },
      workRosterMonth: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const rosters = { generate: jest.fn().mockResolvedValue({}), lockPastDays: jest.fn().mockResolvedValue({ count: 3 }) };
    const automation = new WorkRosterAutomationService(prisma as never, rosters as never);

    await automation.runOnce(new Date('2026-11-20T03:00:00.000Z'));

    expect(rosters.generate).toHaveBeenCalledWith('2026-12', { actorId: 'system:monthly-roster' });
    expect(rosters.lockPastDays).toHaveBeenCalledWith(new Date('2026-11-20T00:00:00.000Z'));
  });

  it('writes an approved shift-change request into the daily roster', async () => {
    const before = {
      id: 'attendance-1', employeeId: 'employee-1', workDate: new Date('2026-12-02'), approvalStatus: 'PENDING',
      approvalUpdate: { exceptionTypes: ['WRONG_SCHEDULE'], items: [{ type: 'WRONG_SCHEDULE', decision: 'PENDING', workScheduleId: 'split', workScheduleBranchIds: ['hn', 'hcm'] }] },
      exceptionType: 'WRONG_SCHEDULE',
    };
    const tx = {
      attendance: {
        update: jest.fn().mockResolvedValue({ ...before, employee: { id: 'employee-1', fullName: 'Nhân viên A', employeeNo: 'A-001' } }),
      },
      workSchedule: { findUnique: jest.fn().mockResolvedValue({ id: 'split', name: 'Ca gãy' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ primaryBranchId: 'hn' }) },
    };
    const prisma = {
      attendance: { findUniqueOrThrow: jest.fn().mockResolvedValue(before) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const roster = { upsertDay: jest.fn().mockResolvedValue({ id: 'daily-1' }) };
    const service = new AttendanceService(prisma as never, {} as never, audit as never, {} as never, {} as never, roster as never);

    await service.reviewApproval('attendance-1', { decision: 'APPROVED' }, { actorId: 'manager-1' });

    expect(roster.upsertDay).toHaveBeenCalledWith(
      tx, 'employee-1', before.workDate, 'split', ['hn', 'hcm'],
      expect.any(String), 'SHIFT_CHANGE_APPROVED', 'manager-1', true,
    );
  });
});
