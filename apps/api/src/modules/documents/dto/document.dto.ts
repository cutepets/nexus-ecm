import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiProperty({ required: false, enum: ['SOP', 'CONTRACT', 'INVOICE', 'LETTER', 'OTHER'] })
  @IsOptional()
  @IsEnum(['SOP', 'CONTRACT', 'INVOICE', 'LETTER', 'OTHER'])
  docType?: string;
}

export class AddVersionDto {
  @ApiProperty({ description: 'Object key returned by the presign step' })
  @IsString()
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sizeBytes?: number;
}

export class ShareDocumentDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ required: false, enum: ['VIEW', 'EDIT'], default: 'VIEW' })
  @IsOptional()
  @IsEnum(['VIEW', 'EDIT'])
  access?: 'VIEW' | 'EDIT';
}
