import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

const DOC_TYPES = ['KTP', 'NPWP', 'CV', 'CONTRACT', 'OTHER'] as const;
type EmployeeDocType = (typeof DOC_TYPES)[number];

/** Step 1: request a presigned upload URL for a document/photo. */
export class PresignUploadDto {
  @ApiProperty({ example: 'ktp.pdf' })
  @IsString()
  fileName!: string;

  @ApiProperty({
    enum: ['photo', 'document'],
    description: 'Upload kind — chooses the storage folder',
  })
  @IsEnum(['photo', 'document'])
  kind!: 'photo' | 'document';
}

/** Step 2: confirm an uploaded document so a DB record is created. */
export class CreateDocumentDto {
  @ApiProperty({ enum: DOC_TYPES })
  @IsEnum(DOC_TYPES)
  docType!: EmployeeDocType;

  @ApiProperty({ description: 'Object key returned by the presign step' })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ example: 'ktp.pdf' })
  @IsString()
  fileName!: string;
}
