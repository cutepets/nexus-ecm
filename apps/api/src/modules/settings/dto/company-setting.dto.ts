import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const LOCALES = ["vi-VN", "en-US"] as const;
const CURRENCIES = ["VND", "USD"] as const;
const EMPLOYMENT_TYPES = [
  "VAN_PHONG",
  "CUA_HANG_POS",
  "CONG_TRUONG",
  "TU_XA",
  "CA_KIP",
] as const;
const PAYROLL_MODES = ["MONTHLY", "HOURLY", "SHIFT", "HYBRID"] as const;

export class UpdateCompanySettingDto {
  @ApiPropertyOptional({ example: "Công ty TNHH Nexus" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @ApiPropertyOptional({ description: "Logo company as a small base64 image" })
  @IsOptional()
  @IsString()
  @MaxLength(3_000_000)
  logo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  removeLogo?: boolean;

  @ApiPropertyOptional({ enum: LOCALES, example: "vi-VN" })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];

  @ApiPropertyOptional({ enum: CURRENCIES, example: "VND" })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: (typeof CURRENCIES)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 6, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekStartsOn?: number;

  @ApiPropertyOptional({
    enum: ["BLINK", "TURN_HEAD", "SMILE", "RANDOM"],
    default: "RANDOM",
  })
  @IsOptional()
  @IsIn(["BLINK", "TURN_HEAD", "SMILE", "RANDOM"])
  livenessMode?: "BLINK" | "TURN_HEAD" | "SMILE" | "RANDOM";

  @ApiPropertyOptional({ minimum: 0.35, maximum: 0.65, default: 0.43 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.35)
  @Max(0.65)
  faceDuplicateThreshold?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 3650, default: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  auditRetentionDays?: number;

  @ApiPropertyOptional({ default: true, description: "Tự sinh lịch tháng kế tiếp" })
  @IsOptional()
  @IsBoolean()
  rosterAutoGenerateEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 28, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  rosterGenerationDay?: number;


  @ApiPropertyOptional({
    example: ["https://chamcong.petshophanoi.com"],
    description: "Các origin HTTPS được phép gọi API.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  trustedWebOrigins?: string[];
}

export class UpdateAttendancePolicyDto {
  @IsOptional()
  @IsIn(["BLINK", "TURN_HEAD", "SMILE", "RANDOM"])
  livenessMode?: "BLINK" | "TURN_HEAD" | "SMILE" | "RANDOM";

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.35)
  @Max(0.65)
  faceDuplicateThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  auditRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  rosterAutoGenerateEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  rosterGenerationDay?: number;

}

export class UpdateEmploymentTypesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(EMPLOYMENT_TYPES, { each: true })
  employmentTypes!: (typeof EMPLOYMENT_TYPES)[number][];
}

export class UpdatePayrollSettingDto {
  @IsOptional()
  @IsIn(PAYROLL_MODES)
  payrollMode?: (typeof PAYROLL_MODES)[number];

  @IsOptional()
  @IsIn(["DAILY", "HOURLY"])
  workUnitMode?: "DAILY" | "HOURLY";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  payrollCutoffDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  timesheetStartDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  timesheetEndDay?: number;

  @IsOptional()
  @IsInt()
  @IsIn([1, 5, 10, 15, 30, 60])
  roundingMinutes?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  latePenaltyPerMinute?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  missingPunchPenalty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  overtimeTriggerMinutes?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10)
  overtimeMultiplier?: number;
}

export class UpdateIntegrationSettingDto {
  @IsOptional()
  @IsBoolean()
  integrationApiEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  integrationAllowedOrigins?: string[];
}

export class CreateBranchDto {
  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(250) address?: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsInt() @Min(10) @Max(10000) radiusMeters?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class ReorderBranchesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  branchIds!: string[];
}

/** @deprecated Branch assignment is retained only for historical records. */
export class CreateEmployeeBranchAssignmentDto {
  @IsString() employeeId!: string;
  @IsString() branchId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() allowRemote?: boolean;
}

export class CreateBranchLocationDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(250) address?: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsInt() @Min(10) @Max(10000) radiusMeters?: number;
  @IsOptional() @IsBoolean() allowRemote?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
