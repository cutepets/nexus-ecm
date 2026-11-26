import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'AUDITOR' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @ApiProperty({ required: false, example: 'AUDITOR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  name?: string;

  @ApiProperty({ required: false, example: 'Giám sát kiểm tra dữ liệu' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['employee:read', 'attendance:read'] })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  roleId!: string;
}
