import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddDocumentDto {
  @ApiProperty({ description: 'Document name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Document URL' })
  @IsUrl()
  url: string;
}
