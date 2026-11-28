import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdateIpSecuritySettingsDto {
  @ApiProperty({ minimum: 5, maximum: 10080, example: 60 })
  @IsInt()
  @Min(5)
  @Max(10080)
  autoUnblockMinutes!: number;
}

export class SetIpBlockDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isPermanent!: boolean;
}
