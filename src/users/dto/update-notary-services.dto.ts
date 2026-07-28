import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateNotaryServicesDto {
  @ApiProperty({
    type: [String],
    description: 'Full set of service IDs this notary offers (replaces existing)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
