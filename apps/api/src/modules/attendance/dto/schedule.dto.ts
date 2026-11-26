import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class UpsertScheduleDto {
  @ApiProperty({ example: 'Default 08:00-17:00' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '08:00' })
  @Matches(TIME, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(TIME, { message: 'endTime must be HH:mm' })
  endTime!: string;

  @ApiProperty({
    required: false,
    example: '17:00',
    description: 'Giờ bắt đầu ca thứ hai cho ca gãy',
  })
  @IsOptional()
  @Matches(TIME, { message: 'secondStartTime phải có định dạng HH:mm' })
  secondStartTime?: string;

  @ApiProperty({
    required: false,
    example: '22:00',
    description: 'Giờ kết thúc ca thứ hai cho ca gãy',
  })
  @ValidateIf((dto) => Boolean(dto.secondStartTime))
  @Matches(TIME, { message: 'secondEndTime phải có định dạng HH:mm' })
  secondEndTime?: string;

  @ApiProperty({ required: false, description: 'Thứ tự hiển thị trong danh sách ca' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ReorderSchedulesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scheduleIds!: string[];
}

export class AssignEmployeeScheduleDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  workScheduleId!: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  @Matches(DATE, { message: 'effectiveFrom phải có định dạng YYYY-MM-DD' })
  effectiveFrom!: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE, { message: 'effectiveTo phải có định dạng YYYY-MM-DD' })
  effectiveTo?: string;

  @ApiProperty({
    required: false,
    description: '0=Chủ nhật … 6=Thứ bảy. Bỏ trống nghĩa là áp dụng mọi ngày.',
    example: [1, 2, 3, 4, 5],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ApiProperty({
    required: false,
    default: 0,
    description: 'Số lớn hơn được ưu tiên khi cùng một ngày có nhiều ca.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertEmployeeScheduleOverrideDto {
  @IsString()
  employeeId!: string;

  @IsString()
  workScheduleId!: string;

  @IsDateString()
  @Matches(DATE, { message: 'workDate phải có định dạng YYYY-MM-DD' })
  workDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
