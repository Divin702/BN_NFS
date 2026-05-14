import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateNotaryServiceDto {
  @ApiProperty({ example: 'Property Sale Notarization' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Notarization of property sale agreements' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5000, description: 'Official fee in RWF (whole numbers)' })
  @IsInt()
  @Min(0)
  officialFee: number;

  @ApiPropertyOptional({ description: 'UUID of the linked document template' })
  @IsOptional()
  @IsUUID()
  linkedTemplateId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
