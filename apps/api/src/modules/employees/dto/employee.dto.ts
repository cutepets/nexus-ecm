import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const WORK_STATUS = ['PROBATION', 'PERMANENT', 'CONTRACT', 'INACTIVE'] as const;
type WorkStatus = (typeof WORK_STATUS)[number];

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ required: false, description: 'Auto-generated when omitted' })
  @IsOptional()
  @IsString()
  employeeNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

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
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

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

  @ApiProperty({ enum: WORK_STATUS, required: false })
  @IsOptional()
  @IsEnum(WORK_STATUS)
  workStatus?: WorkStatus;

  @ApiProperty({ required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
