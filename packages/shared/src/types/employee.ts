/** Shared employee-domain types used by both API and web. */

export type WorkStatus = 'PROBATION' | 'PERMANENT' | 'ON_LEAVE' | 'INACTIVE' | 'ABANDONED';

export type EmployeeDocType = 'KTP' | 'NPWP' | 'CV' | 'CONTRACT' | 'OTHER';

export type DocVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Department {
  id: string;
  name: string;
  code: string;
  managerId?: string | null;
  createdAt: string;
  _count?: { employees: number; positions: number };
}

export interface Position {
  id: string;
  title: string;
  departmentId: string;
  level: number;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  _count?: { employees: number };
}

export interface EmployeeListItem {
  id: string;
  employeeNo: string;
  fullName: string;
  jobTitle?: string;
  email?: string | null;
  phone?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED' | null;
  dateOfBirth?: string | null;
  identityCode?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  photoUrl?: string | null;
  basicSalary?: string | null;
  spaBonusPercent?: string | null;
  taxCode?: string | null;
  salaryBankName?: string | null;
  salaryBankAccount?: string | null;
  employmentType?: 'FULL_TIME' | 'PART_TIME';
  exitDate?: string | null;
  manager?: Pick<EmployeeListItem, 'id' | 'fullName' | 'employeeNo'> | null;
  primaryBranch?: { id: string; code: string; name: string; address?: string | null } | null;
  branchAssignments?: { id: string; branch: { id: string; code: string; name: string; address?: string | null } }[];
  workScheduleAssignments?: { id: string; workSchedule: { id: string; name: string; startTime: string; endTime: string } }[];
  workStatus: WorkStatus;
  probationDays?: number;
  joinDate: string;
  department?: Pick<Department, 'id' | 'name' | 'code'> | null;
  position?: Pick<Position, 'id' | 'title'> | null;
  user?: { username: string; email: string; isActive: boolean; lastLoginAt?: string | null; roles: { role: { id: string; code: string; name: string } }[] } | null;
}

export interface JobHistoryEntry {
  id: string;
  startDate: string;
  endDate?: string | null;
  note?: string | null;
  position?: Pick<Position, 'id' | 'title'> | null;
  department?: Pick<Department, 'id' | 'name'> | null;
}

export interface SalaryHistoryEntry {
  id: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  reason?: string | null;
}

export interface EmploymentHistoryEntry {
  id: string;
  effectiveDate: string;
  changeType: string;
  reason?: string | null;
  decisionNumber?: string | null;
  changes: { field: string; before: unknown; after: unknown }[];
  createdAt: string;
  documents: EmployeeDocument[];
}

export interface EmployeeDocument {
  id: string;
  docType: EmployeeDocType;
  fileUrl: string;
  fileName: string;
  status: DocVerifyStatus;
  uploadedAt: string;
}

export interface EmployeeDetail extends EmployeeListItem {
  managerId?: string | null;
  jobHistory: JobHistoryEntry[];
  salaryHistory: SalaryHistoryEntry[];
  employmentHistory: EmploymentHistoryEntry[];
  documents: EmployeeDocument[];
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; email: string; phone?: string | null; isActive: boolean; lastLoginAt?: string | null; roles: { role: { id: string; code: string; name: string } }[] } | null;
}
