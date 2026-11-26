import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTimesheetPeriodDto {
  @ApiProperty({ example: '2026-11-26' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  endDate!: string;
}

export class ReopenTimesheetPeriodDto {
  @ApiProperty({ example: 'Điều chỉnh công đã duyệt' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class TimesheetQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}
