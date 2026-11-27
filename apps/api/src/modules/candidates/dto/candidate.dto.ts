import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CandidateStatus } from '@nexus/database';
import { ArrayUnique, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateCandidateDto {
  @ApiProperty({ example: 'Nguyễn Minh Anh' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @Matches(/^[+\d\s().-]{7,24}$/)
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ required: false, description: 'MinIO object key for the candidate photo' })
  @IsOptional()
  @IsString()
  photoKey?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  desiredBranchIds?: string[];

  @ApiProperty({ required: false, example: 'Ca sáng' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  desiredShift?: string;

  @ApiProperty({ required: false, example: '2026-12-01' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsDateString()
  desiredStartDate?: string;

  @ApiProperty({ required: false, example: 'Facebook' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateCandidateDto extends PartialType(CreateCandidateDto) {
  @ApiPropertyOptional({ enum: CandidateStatus, default: CandidateStatus.REVIEW })
  @IsOptional()
  @IsEnum(CandidateStatus)
  status?: CandidateStatus;
}

export class PresignCandidatePhotoDto {
  @ApiProperty({ example: 'candidate-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/\.(jpe?g|png|webp)$/i, { message: 'Photo must be a JPG, PNG, or WebP image' })
  fileName!: string;
}
