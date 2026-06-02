import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateJobHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSalaryHistoryDto {
  @ApiProperty({ example: '12000000.00', description: 'Decimal amount as string' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ required: false, default: 'IDR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  effectiveDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
