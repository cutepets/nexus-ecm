/** Shared employee-domain types used by both API and web. */

export type WorkStatus = 'PROBATION' | 'PERMANENT' | 'CONTRACT' | 'INACTIVE';

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
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  workStatus: WorkStatus;
  joinDate: string;
  department?: Pick<Department, 'id' | 'name' | 'code'> | null;
  position?: Pick<Position, 'id' | 'title'> | null;
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

export interface EmployeeDocument {
  id: string;
  docType: EmployeeDocType;
  fileUrl: string;
  fileName: string;
  status: DocVerifyStatus;
  uploadedAt: string;
}

export interface EmployeeDetail extends EmployeeListItem {
  address?: string | null;
  exitDate?: string | null;
  managerId?: string | null;
  manager?: Pick<EmployeeListItem, 'id' | 'fullName' | 'employeeNo'> | null;
  jobHistory: JobHistoryEntry[];
  salaryHistory: SalaryHistoryEntry[];
  documents: EmployeeDocument[];
  createdAt: string;
  updatedAt: string;
}
