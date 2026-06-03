import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty({ required: false, description: 'Omitted by employees — auto-filled with their own id' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty()
  @IsString()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-07-03' })
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiProperty({ required: false, description: 'Object key from the presign upload' })
  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class DecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class LeaveQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class PresignLeaveDocDto {
  @ApiProperty({ example: 'surat-dokter.pdf' })
  @IsString()
  fileName!: string;
}
