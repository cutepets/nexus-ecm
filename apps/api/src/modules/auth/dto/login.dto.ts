import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin hoặc 0901234567 hoặc admin@gmail.com',
    description: 'Tên đăng nhập, số điện thoại Việt Nam hoặc email',
  })
  @ValidateIf((dto: LoginDto) => !dto.email)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier?: string;

  @ApiProperty({
    example: 'admin@nexus.local',
    required: false,
    deprecated: true,
    description: 'Tương thích client cũ; dùng identifier cho client mới',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(6)
  password!: string;
}
