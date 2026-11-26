import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const INTEGRATION_SCOPES = [
  "employees:read",
  "branches:read",
  "attendance:read",
  "kpi-events:write",
] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export class CreateIntegrationApiKeyDto {
  @ApiProperty({ example: "POS cửa hàng" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: INTEGRATION_SCOPES,
    isArray: true,
    example: ["employees:read", "branches:read"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  scopes!: IntegrationScope[];

  @ApiProperty({
    required: false,
    description: "Giới hạn dữ liệu theo các mã định danh chi nhánh.",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  branchIds?: string[];

  @ApiProperty({ required: false, example: "2027-01-01" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateKpiEventDto {
  @ApiProperty({ description: "Mã sự kiện duy nhất do POS/KPI cung cấp." })
  @IsString()
  @MaxLength(160)
  externalId!: string;

  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  branchId!: string;

  @ApiProperty({ example: "2026-11-20T08:00:00.000Z" })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesAmount?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  orderCount?: number;

  @ApiProperty({ required: false, default: "VND" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({
    required: false,
    description: "Metadata nghiệp vụ không chứa dữ liệu sinh trắc học/GPS.",
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class CreateIntegrationKpiFieldDto {
  @ApiProperty({ example: "customerCount" })
  @IsString()
  @Matches(/^[a-z][a-zA-Z0-9_]{1,63}$/)
  key!: string;

  @ApiProperty({ example: "Số khách phục vụ" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: ["NUMBER", "TEXT", "BOOLEAN"], default: "NUMBER" })
  @IsIn(["NUMBER", "TEXT", "BOOLEAN"])
  fieldType!: "NUMBER" | "TEXT" | "BOOLEAN";

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateIntegrationWebhookDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes?: string[];
}
