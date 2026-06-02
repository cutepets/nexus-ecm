import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ required: false, description: 'Auto-generated when omitted' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ required: false, default: 'pcs' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  reorderLevel?: number;

  @ApiProperty({ required: false, description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {}

export class NamedDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;
}

export class StockMovementDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty()
  @IsString()
  warehouseId!: string;

  @ApiProperty({ enum: ['IN', 'OUT', 'ADJUST'] })
  @IsEnum(['IN', 'OUT', 'ADJUST'])
  type!: 'IN' | 'OUT' | 'ADJUST';

  @ApiProperty({ description: 'Quantity; for ADJUST use a signed delta' })
  @IsInt()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
