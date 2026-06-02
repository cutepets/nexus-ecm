import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  issueDate!: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ required: false, description: 'Tax rate percent, e.g. 11 for PPN', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class AddPaymentDto {
  @ApiProperty({ description: 'Decimal amount string' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  paidAt!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class InvoiceQueryDto {
  @ApiProperty({ required: false, enum: ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'])
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'SENT', 'VOID'] })
  @IsEnum(['DRAFT', 'SENT', 'VOID'])
  status!: 'DRAFT' | 'SENT' | 'VOID';
}
