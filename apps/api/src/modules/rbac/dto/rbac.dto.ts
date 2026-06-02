import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

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

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['employee:read', 'finance:read'] })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  roleId!: string;
}
