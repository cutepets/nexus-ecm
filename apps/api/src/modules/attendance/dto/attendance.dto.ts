import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CheckDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ type: [Number], description: '128-d descriptor from the browser' })
  @IsArray()
  @ArrayMinSize(1)
  embedding!: number[];

  @ApiProperty({ description: 'Anti-spoofing challenge result' })
  @IsBoolean()
  livenessPassed!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ required: false, description: 'Base64 JPEG audit photo' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

export class AttendanceQueryDto {
  @ApiProperty({ required: false, description: 'ISO date, defaults to today' })
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
  status?: string;
}
