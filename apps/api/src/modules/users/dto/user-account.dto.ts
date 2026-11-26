import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

export class UserAccountQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiProperty({ required: false, description: 'Search name, username, email, or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Filter by role id' })
  @IsOptional()
  @IsString()
  roleId?: string;
}

export class CreateUserAccountDto {
  @ApiProperty({ example: 'nguyen.van.a' })
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message: 'Username must be 3-32 lowercase characters and contain only letters, numbers, dot, underscore, or hyphen',
  })
  username!: string;

  @ApiProperty({ example: 'a.nguyen@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false, example: '0901234567', description: 'Vietnamese mobile number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ minLength: 8, format: 'password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ type: [String], description: 'At least one role id is required' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  roleIds!: string[];

  @ApiProperty({ format: 'password', description: 'Current password of the administrator assigning roles' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class UpdateUserAccountDto {
  @ApiProperty({ required: false, example: 'nguyen.van.a' })
  @IsOptional()
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message: 'Username must be 3-32 lowercase characters and contain only letters, numbers, dot, underscore, or hyphen',
  })
  username?: string;

  @ApiProperty({ required: false, example: 'a.nguyen@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '0901234567', description: 'Empty value removes the phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;
}

/** Fields an authenticated person may change on their own account. */
export class UpdateMyProfileDto {
  @ApiProperty({ required: false, example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiProperty({ required: false, example: 'a.nguyen@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'Object key returned by the personal avatar upload endpoint' })
  @IsOptional()
  @IsString()
  avatarKey?: string;

  @ApiProperty({ required: false, description: 'Object key for the square avatar crop used in circular UI avatars' })
  @IsOptional()
  @IsString()
  avatarCropKey?: string;

  @ApiProperty({ required: false, description: 'Object key for the portrait-ratio employee photo crop' })
  @IsOptional()
  @IsString()
  avatarPortraitKey?: string;

  @ApiProperty({ required: false, example: 'Vietcombank' })
  @IsOptional()
  @IsString()
  salaryBankName?: string;

  @ApiProperty({ required: false, example: '0123456789' })
  @IsOptional()
  @IsString()
  salaryBankAccount?: string;
}

export class ChangeMyPasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class PresignMyAvatarDto {
  @ApiProperty({ example: 'avatar.jpg' })
  @IsString()
  fileName!: string;
}

export class SetAccountStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ format: 'password', description: 'Current password of the administrator performing the action' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8, format: 'password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ format: 'password', description: 'Current password of the administrator performing the action' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class SetUserRolesDto {
  @ApiProperty({ type: [String], description: 'At least one role id is required' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  roleIds!: string[];

  @ApiProperty({ format: 'password', description: 'Current password of the administrator performing the action' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class SensitiveAccountActionDto {
  @ApiProperty({ format: 'password', description: 'Current password of the administrator performing the action' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class LinkEmployeeAccountDto {
  @ApiProperty({ required: false, nullable: true, description: 'Employee id; null unlinks the current employee' })
  @IsOptional()
  @IsString()
  employeeId?: string;
}
