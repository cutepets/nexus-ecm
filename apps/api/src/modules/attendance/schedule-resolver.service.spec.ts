import { ScheduleResolverService } from './schedule-resolver.service';

describe('ScheduleResolverService', () => {
  const workSchedule = {
    id: 'shift-morning',
    name: 'Ca sáng',
    startTime: '08:00',
    endTime: '17:00',
    secondStartTime: null,
    secondEndTime: null,
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      employeeScheduleOverride: { findUnique: jest.fn().mockResolvedValue(null) },
      employeeDailySchedule: { findUnique: jest.fn().mockResolvedValue(null) },
      employeeWorkScheduleAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
    return { service: new ScheduleResolverService(prisma as never), prisma };
  }

  it('uses the date-specific override before a recurring assignment', async () => {
    const { service, prisma } = createService({
      employeeScheduleOverride: {
        findUnique: jest.fn().mockResolvedValue({ id: 'override-1', workSchedule }),
      },
    });

    await expect(service.resolve('employee-1', new Date('2026-11-23T15:30:00+07:00'))).resolves.toEqual({
      workSchedule,
      source: 'OVERRIDE',
      overrideId: 'override-1',
    });
    expect(prisma.employeeWorkScheduleAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('uses a published day roster before the legacy override', async () => {
    const { service, prisma } = createService({
      employeeDailySchedule: {
        findUnique: jest.fn().mockResolvedValue({
          workSchedule,
          rosterMonth: { status: 'PUBLISHED' },
        }),
      },
    });

    await expect(service.resolve('employee-1', new Date('2026-11-23T00:00:00.000Z'))).resolves.toEqual({
      workSchedule,
      source: 'ROSTER',
    });
    expect(prisma.employeeScheduleOverride.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the highest-priority effective weekday assignment', async () => {
    const { service, prisma } = createService({
      employeeWorkScheduleAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'assignment-1', workSchedule }),
      },
    });

    await expect(service.resolve('employee-1', new Date('2026-11-23T00:00:00.000Z'))).resolves.toEqual({
      workSchedule,
      source: 'ASSIGNMENT',
      assignmentId: 'assignment-1',
    });
    expect(prisma.employeeWorkScheduleAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'employee-1' }),
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('returns null when the employee has no effective schedule', async () => {
    const { service } = createService();

    await expect(service.resolve('employee-1', new Date('2026-11-23T00:00:00.000Z'))).resolves.toBeNull();
  });
});
