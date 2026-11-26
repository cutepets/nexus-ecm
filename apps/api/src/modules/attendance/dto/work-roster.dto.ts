import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateWorkRosterDto {
  /** YYYY-MM */
  @IsString()
  month!: string;
}

export class UpdateDailyScheduleDto {
  @IsString()
  employeeId!: string;

  /** YYYY-MM-DD */
  @IsString()
  workDate!: string;

  @IsString()
  workScheduleId!: string;

  /** One store for a regular shift, two stores for a split shift. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ApplyWorkScheduleRangeDto {
  @IsString()
  employeeId!: string;

  /** Inclusive start date, YYYY-MM-DD. */
  @IsString()
  fromDate!: string;

  /** Inclusive end date, YYYY-MM-DD. */
  @IsString()
  toDate!: string;

  @IsString()
  workScheduleId!: string;

  /** One branch is selected in the UI and used for each shift segment. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  branchIds!: string[];
}

export class BulkDeleteWorkRosterDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @IsDateString({}, { each: true })
  workDates!: string[];

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class CopyWorkRosterDayDto {
  @IsDateString()
  sourceDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @IsDateString({}, { each: true })
  targetDates!: string[];

  @IsString()
  branchId!: string;
}
