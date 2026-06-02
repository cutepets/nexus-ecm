import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'] })
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'])
  status!: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';
}

export class CreateOpportunityDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  stageId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiProperty({ required: false, description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  value?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedClose?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class MoveOpportunityDto {
  @ApiProperty()
  @IsString()
  stageId!: string;
}

export class CreateInteractionDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ enum: ['CALL', 'EMAIL', 'MEETING', 'NOTE'] })
  @IsEnum(['CALL', 'EMAIL', 'MEETING', 'NOTE'])
  type!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  summary!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class CreateStageDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  orderIndex?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  probability?: number;
}
