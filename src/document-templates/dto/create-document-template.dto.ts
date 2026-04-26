import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';
import { TemplateStatus } from '../enums/template-status.enum';

export class CreateDocumentTemplateDto {
  @ApiProperty({ example: 'Property Sale Agreement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'TPL-RE-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'templateCode must be uppercase letters, numbers, underscores, or hyphens' })
  templateCode: string;

  @ApiPropertyOptional({ example: 'Standard agreement for residential property sales' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Rich text content (HTML)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of uploaded .docx file' })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ enum: TemplateStatus, default: TemplateStatus.DRAFT })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ description: 'UUID of the template category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
