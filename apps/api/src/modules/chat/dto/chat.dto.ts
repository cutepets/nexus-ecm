import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ enum: ['DIRECT', 'GROUP'] })
  @IsEnum(['DIRECT', 'GROUP'])
  type!: 'DIRECT' | 'GROUP';

  @ApiProperty({ required: false, description: 'Group name (required for GROUP)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: [String], description: 'Member user ids (excluding the creator)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiProperty({ type: [String], required: false, description: 'Mentioned user ids' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionIds?: string[];
}

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  body!: string;

  @ApiProperty({ required: false, enum: ['ALL', 'DEPARTMENT', 'ROLE'], default: 'ALL' })
  @IsOptional()
  @IsEnum(['ALL', 'DEPARTMENT', 'ROLE'])
  audience?: 'ALL' | 'DEPARTMENT' | 'ROLE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetRef?: string;
}
