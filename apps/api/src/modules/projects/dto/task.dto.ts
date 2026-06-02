import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
type TaskPriority = (typeof PRIORITY)[number];
type TaskStatus = (typeof STATUS)[number];

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiProperty({ enum: PRIORITY, required: false, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(PRIORITY)
  priority?: TaskPriority;

  @ApiProperty({ enum: STATUS, required: false, default: 'TODO' })
  @IsOptional()
  @IsEnum(STATUS)
  status?: TaskStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class MoveTaskDto {
  @ApiProperty({ enum: STATUS })
  @IsEnum(STATUS)
  status!: TaskStatus;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

export class TaskQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiProperty({ enum: STATUS, required: false })
  @IsOptional()
  @IsEnum(STATUS)
  status?: TaskStatus;

  @ApiProperty({ enum: PRIORITY, required: false })
  @IsOptional()
  @IsEnum(PRIORITY)
  priority?: TaskPriority;
}

export class ChecklistItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;
}

export class CommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiProperty({ required: false, description: 'Author employee id; defaults to the caller’s employee' })
  @IsOptional()
  @IsString()
  authorId?: string;
}

export class AddAttachmentDto {
  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;
}
