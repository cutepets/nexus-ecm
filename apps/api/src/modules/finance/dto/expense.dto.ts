import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ description: 'Decimal amount string' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  spentAt!: string;

  @ApiProperty({ required: false, description: 'Object key of an uploaded receipt' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class ExpenseStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'APPROVED', 'PAID'] })
  @IsEnum(['DRAFT', 'APPROVED', 'PAID'])
  status!: 'DRAFT' | 'APPROVED' | 'PAID';
}

export class CreateReimbursementDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ description: 'Decimal amount string' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class ReimbursementDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'PAID'] })
  @IsEnum(['APPROVED', 'REJECTED', 'PAID'])
  status!: 'APPROVED' | 'REJECTED' | 'PAID';
}

export class FinanceRangeDto {
  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
