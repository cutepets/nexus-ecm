import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const PROJECT_STATUS = ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
type ProjectStatus = (typeof PROJECT_STATUS)[number];

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Revamp' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'WEB-2026' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PROJECT_STATUS, required: false, default: 'PLANNING' })
  @IsOptional()
  @IsEnum(PROJECT_STATUS)
  status?: ProjectStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ required: false, description: 'Planned budget (decimal string)' })
  @IsOptional()
  @IsNumberString()
  budgetPlanned?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  budgetActual?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ required: false, example: 'Developer' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class UpsertMilestoneDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
