import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CheckDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({
    type: [Number],
    description: "128-d descriptor from the browser",
  })
  @IsArray()
  @ArrayMinSize(1)
  embedding!: number[];

  @ApiProperty({ description: "Anti-spoofing challenge result" })
  @IsBoolean()
  livenessPassed!: boolean;

  @ApiProperty({
    required: false,
    enum: ["NONE", "BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE"],
  })
  @IsOptional()
  @IsIn(["NONE", "BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE"])
  livenessChallenge?: "NONE" | "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE";

  @ApiProperty({
    required: false,
    description: "Short-lived signed liveness challenge",
  })
  @IsOptional()
  @IsString()
  livenessToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({
    required: false,
    description: "GPS horizontal accuracy in meters",
  })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @ApiProperty({ required: false, description: "Base64 JPEG audit photo" })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

/** Kiosk/mobile check without exposing or selecting an employee identity. */
export class IdentifyCheckDto {
  @ApiProperty({
    description:
      "Explicit confirmation that the device is being borrowed to punch for the face being identified",
  })
  @IsBoolean()
  @Equals(true)
  borrowedAttendanceConfirmed!: boolean;

  @ApiProperty({
    type: [Number],
    description: "128-d descriptor from the browser",
  })
  @IsArray()
  @ArrayMinSize(1)
  embedding!: number[];

  @IsBoolean()
  livenessPassed!: boolean;

  @IsOptional()
  @IsIn(["NONE", "BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE"])
  livenessChallenge?: "NONE" | "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE";

  @IsOptional()
  @IsString()
  livenessToken?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

export class CreateAttendanceApprovalRequestDto {
  @IsString()
  employeeId!: string;

  /** Existing daily attendance to review; keeps a historical request on its selected date. */
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @IsIn(["CHECK_IN", "CHECK_OUT", "REVIEW"])
  action!: "CHECK_IN" | "CHECK_OUT" | "REVIEW";

  @IsIn([
    "OUTSIDE_GEOFENCE",
    "WRONG_SCHEDULE",
    "FACE_UNRECOGNIZED",
    "GPS_UNAVAILABLE",
    "MISSED_PUNCH",
    "LATE_ARRIVAL",
    "OTHER",
    "OVERTIME",
  ])
  exceptionType!:
    | "OUTSIDE_GEOFENCE"
    | "WRONG_SCHEDULE"
    | "FACE_UNRECOGNIZED"
    | "GPS_UNAVAILABLE"
    | "MISSED_PUNCH"
    | "LATE_ARRIVAL"
    | "OTHER";

  /** Several fixes can be requested against the same attendance day. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(
    [
      "OUTSIDE_GEOFENCE",
      "WRONG_SCHEDULE",
      "FACE_UNRECOGNIZED",
      "GPS_UNAVAILABLE",
      "MISSED_PUNCH",
      "LATE_ARRIVAL",
      "OTHER",
      "OVERTIME",
    ],
    { each: true },
  )
  exceptionTypes?: Array<
    | "OUTSIDE_GEOFENCE"
    | "WRONG_SCHEDULE"
    | "FACE_UNRECOGNIZED"
    | "GPS_UNAVAILABLE"
    | "MISSED_PUNCH"
    | "LATE_ARRIVAL"
    | "OTHER"
    | "OVERTIME"
  >;

  @IsOptional()
  @IsNumber()
  overtimeMinutes?: number;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  note!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  photo?: string;

  /** Images submitted as evidence, separate from the automatic audit photo. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(8_000_000, { each: true })
  evidencePhotos?: string[];

  @IsOptional()
  @IsString()
  targetEmployeeId?: string;

  @IsOptional()
  @IsString()
  branchLocationId?: string;

  @IsOptional()
  @IsString()
  workScheduleId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  workScheduleBranchIds?: string[];

  @IsOptional()
  @IsIn(["CHECK_IN", "CHECK_OUT"])
  appliesTo?: "CHECK_IN" | "CHECK_OUT";

  @IsOptional()
  @IsDateString()
  proposedCheckIn?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckOut?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckIn2?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckOut2?: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

/** Self-service fallback after automatic face verification fails twice. */
export class CreateManualAttendanceRequestDto {
  @IsString()
  employeeId!: string;

  @IsIn(["CHECK_IN", "CHECK_OUT"])
  action!: "CHECK_IN" | "CHECK_OUT";

  @IsString()
  workScheduleId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @MaxLength(8_000_000)
  photo!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

export class ReviewAttendanceDto {
  @IsOptional()
  @IsIn(["APPROVED", "REJECTED", "NEEDS_MORE_INFO"])
  decision?: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  itemReviews?: Array<{
    type: string;
    decision: "APPROVED" | "REJECTED";
    note?: string;
    proposedCheckIn?: string;
    proposedCheckOut?: string;
    proposedCheckIn2?: string;
    proposedCheckOut2?: string;
    workScheduleId?: string;
    workScheduleBranchIds?: string[];
    workScheduleName?: string;
    branchLocationId?: string;
    targetEmployeeId?: string;
    overtimeMinutes?: number;
  }>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateAttendanceSessionDto {
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;
}

export class CreateAttendanceSessionDto {
  @IsDateString()
  checkInAt!: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;
}

export class UpdateAttendanceAdjustmentDto {
  @IsOptional()
  @IsString()
  workScheduleId?: string;

  @IsOptional()
  @IsNumber()
  latePenalty?: number;

  @IsOptional()
  @IsNumber()
  reward?: number;
}

export class CreateAttendanceCorrectionDto {
  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsDateString()
  proposedCheckIn?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckOut?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000_000)
  evidencePhoto?: string;
}

export class UpdateAttendanceCorrectionDto {
  @IsOptional()
  @IsDateString()
  proposedCheckIn?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckOut?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000_000)
  evidencePhoto?: string;
}

export class ReviewAttendanceCorrectionDto {
  @IsIn(["APPROVED", "REJECTED", "NEEDS_MORE_INFO"])
  decision!: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateOvertimeRequestDto {
  @IsString()
  attendanceId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class AttendanceQueryDto {
  @ApiProperty({ required: false, description: "ISO date, defaults to today" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(["APPROVED", "PENDING", "REJECTED"])
  approvalStatus?: "APPROVED" | "PENDING" | "REJECTED";
}
