import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionScopeDto)
  permissions!: RolePermissionScopeDto[];
}

export class RolePermissionScopeDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty({ enum: ['ALL', 'BRANCH', 'SELF', 'NONE'] })
  @IsIn(['ALL', 'BRANCH', 'SELF', 'NONE'])
  scope!: 'ALL' | 'BRANCH' | 'SELF' | 'NONE';
}

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  roleId!: string;
}

export class RoleAssignmentRuleDto {
  @ApiProperty({ example: 'Quản lý chi nhánh A' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  roleId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoleAssignmentRulesDto {
  @ApiProperty({ type: [RoleAssignmentRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentRuleDto)
  rules!: RoleAssignmentRuleDto[];
}
