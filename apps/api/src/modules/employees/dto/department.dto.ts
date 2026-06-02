import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'HR' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ required: false, description: 'Employee id of the department manager' })
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateDepartmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;
}
