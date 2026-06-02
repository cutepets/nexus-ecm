import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class EnrollFaceDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({
    type: [[Number]],
    description: 'One or more 128-d descriptors computed in the browser',
  })
  @IsArray()
  @ArrayMinSize(1)
  embeddings!: number[][];

  @ApiProperty({ required: false, description: 'Base64 JPEG sample image for audit' })
  @IsOptional()
  @IsString()
  sampleImage?: string;
}
