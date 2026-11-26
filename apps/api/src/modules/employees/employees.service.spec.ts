import { EmployeesService } from './employees.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const historyDelegates = [
  'attendance', 'leaveRequest', 'jobHistory', 'salaryHistory', 'employeeDocument',
  'faceProfile', 'attendanceCorrectionRequest', 'attendanceOvertimeRequest',
  'timesheetEntry', 'integrationKpiEvent', 'projectMember', 'taskAssignee',
  'taskComment', 'leaveApproval', 'auditLog',
] as const;

function createService(attendanceCount = 0) {
  const prisma: Record<string, unknown> = {
    employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1', fullName: 'Demo Employee', userId: null }) },
  };
  for (const delegate of historyDelegates) {
    prisma[delegate] = { count: jest.fn().mockResolvedValue(delegate === 'attendance' ? attendanceCount : 0) };
  }
  return new EmployeesService(prisma as unknown as PrismaService, {} as never, { record: jest.fn() } as never, {} as never);
}

describe('EmployeesService.getDeletionEligibility', () => {
  it('allows permanent deletion only when every protected history count is zero', async () => {
    const result = await createService().getDeletionEligibility('emp-1');

    expect(result).toMatchObject({ employeeId: 'emp-1', canDelete: true, total: 0 });
  });

  it('blocks deletion when attendance history exists', async () => {
    const result = await createService(1).getDeletionEligibility('emp-1');

    expect(result).toMatchObject({ canDelete: false, total: 1, history: { attendance: 1 } });
  });
});
