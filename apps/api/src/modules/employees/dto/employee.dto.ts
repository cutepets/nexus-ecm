import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsArray,
  IsBoolean,
  ArrayUnique,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const WORK_STATUS = ['PROBATION', 'PERMANENT', 'ON_LEAVE', 'INACTIVE', 'ABANDONED'] as const;
type WorkStatus = (typeof WORK_STATUS)[number];
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
type Gender = (typeof GENDERS)[number];

export function normalizeEmployeePhone(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  const input = String(value).trim();
  const compact = input.replace(/[\s().-]/g, '');
  return /^\d{9}$/.test(compact) ? `0${compact}` : input;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ required: false, default: 'Nhân viên' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ required: false, description: 'Auto-generated when omitted' })
  @IsOptional()
  @IsString()
  employeeNo?: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'nguyen.van.a' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/, {
    message: 'Username must be 3-32 lowercase characters and contain only letters, numbers, dot, underscore, or hyphen',
  })
  username!: string;

  @ApiProperty({ required: false, default: '123456', description: 'Initial login password' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => normalizeEmployeePhone(value))
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: GENDERS, required: false })
  @IsOptional()
  @IsEnum(GENDERS)
  gender?: Gender;

  @ApiProperty({ required: false, example: '1995-05-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, description: 'Vietnamese identity card number (9 or 12 digits)' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @Matches(/^\d{9}$|^\d{12}$/, { message: 'CCCD/CMND must contain 9 or 12 digits' })
  identityCode?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => normalizeEmployeePhone(value))
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiProperty({ required: false, description: 'Tax code; visible only to payroll users' })
  @IsOptional()
  @Matches(/^\d{10}(-\d{3})?$/, { message: 'Tax code must contain 10 digits, optionally followed by - and 3 digits' })
  taxCode?: string;

  @ApiProperty({ required: false, description: 'Salary bank; visible only to payroll users' })
  @IsOptional()
  @IsString()
  salaryBankName?: string;

  @ApiProperty({ required: false, description: 'Salary bank account; visible only to payroll users' })
  @IsOptional()
  @IsString()
  salaryBankAccount?: string;

  @ApiProperty({ required: false, example: 8000000, description: 'Base monthly salary' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  basicSalary?: number;

  @ApiProperty({ required: false, example: 10, description: 'Spa commission percentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  spaBonusPercent?: number;

  @ApiProperty({ required: false, default: 20, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  probationDays?: number;

  @ApiProperty({ enum: ['FULL_TIME', 'PART_TIME'], required: false, default: 'FULL_TIME' })
  @IsOptional()
  @IsEnum(['FULL_TIME', 'PART_TIME'])
  employmentType?: 'FULL_TIME' | 'PART_TIME';

  @ApiProperty({ description: 'Primary work branch' })
  @IsString()
  primaryBranchId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ enum: WORK_STATUS, required: false, default: 'PROBATION' })
  @IsOptional()
  @IsEnum(WORK_STATUS)
  workStatus?: WorkStatus;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  joinDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  exitDate?: string;

  @ApiProperty({ required: false, description: 'Object key returned by the upload presign' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ required: false, description: 'Pre-uploaded front image of the identity card' })
  @IsOptional()
  @IsString()
  identityCardFrontUrl?: string;

  @ApiProperty({ required: false, description: 'Pre-uploaded back image of the identity card' })
  @IsOptional()
  @IsString()
  identityCardBackUrl?: string;

  @ApiProperty({ required: false, type: [String], description: 'Active branch assignments; managed only by branch administrators' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  branchIds?: string[];

  @ApiProperty({ required: false, description: 'Active work schedule; managed only by attendance-policy administrators' })
  @IsOptional()
  @IsString()
  workScheduleId?: string;
}

class EmploymentHistoryDocumentDto {
  @IsString()
  fileUrl!: string;

  @IsString()
  fileName!: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiProperty({ required: false, example: '2026-11-25' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  changeReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  decisionNumber?: string;

  @ApiProperty({ required: false, type: [EmploymentHistoryDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmploymentHistoryDocumentDto)
  historyDocuments?: EmploymentHistoryDocumentDto[];
}

export class TerminateEmployeeDto {
  @ApiProperty({ example: '2026-11-21' })
  @IsDateString()
  terminationDate!: string;

  @ApiProperty({ example: 'Kết thúc hợp đồng' })
  @IsString()
  @MinLength(3)
  terminationReason!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  decisionNumber?: string;

  @ApiProperty({ required: false, type: [EmploymentHistoryDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmploymentHistoryDocumentDto)
  historyDocuments?: EmploymentHistoryDocumentDto[];
}

/** Password confirmation for an irreversible employee/account purge. */
export class PermanentDeleteEmployeeDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại của admin đang thao tác' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;
}

export class EmployeeQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;

  @ApiProperty({ required: false, description: 'Search by name, employee no, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ required: false, description: 'Filter employees whose exit date is today or in the future' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  upcomingExit?: boolean;

  @ApiProperty({ enum: WORK_STATUS, isArray: true, required: false })
  @Transform(({ value }) => value === undefined || value === null ? value : (Array.isArray(value) ? value : String(value).split(',')).flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean))
  @IsOptional()
  @IsArray()
  @IsEnum(WORK_STATUS, { each: true })
  workStatus?: WorkStatus[];

  @ApiProperty({ required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
