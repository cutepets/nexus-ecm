import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  @ApiProperty({ required: false, default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;
}
