import { BadRequestException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

describe('SchedulesService employee assignments', () => {
  const employee = { id: 'employee-1' };
  const schedule = { id: 'schedule-1' };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      workSchedule: { findUnique: jest.fn().mockResolvedValue(schedule) },
      employeeWorkScheduleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
      ...overrides,
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const resolver = { resolve: jest.fn() };
    return { service: new SchedulesService(prisma as never, audit as never, resolver as never), prisma, audit };
  }

  const assignment = {
    employeeId: employee.id,
    workScheduleId: schedule.id,
    effectiveFrom: '2026-11-20',
    weekdays: [1, 2, 3, 4, 5],
  };

  it('rejects a period that ends before it starts', async () => {
    const { service } = createService();

    await expect(service.assignEmployee({ ...assignment, effectiveTo: '2026-11-19' }, { actorId: 'admin-1' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects overlapping effective dates when weekdays overlap', async () => {
    const { service } = createService({
      employeeWorkScheduleAssignment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'existing-1', weekdays: [1, 6] }]),
        create: jest.fn(),
      },
    });

    await expect(service.assignEmployee(assignment, { actorId: 'admin-1' })).rejects.toThrow(
      'Nhân viên đã có ca trùng ngày hiệu lực và ngày trong tuần',
    );
  });

  it('allows assignments with different weekdays in the same period and audits them', async () => {
    const { service, prisma, audit } = createService({
      employeeWorkScheduleAssignment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'existing-1', weekdays: [0, 6] }]),
        create: jest.fn().mockResolvedValue({ id: 'assignment-1', employee, workSchedule: schedule }),
      },
    });

    await service.assignEmployee(assignment, { actorId: 'admin-1' });

    expect(prisma.employeeWorkScheduleAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weekdays: [1, 2, 3, 4, 5] }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
  });
});
