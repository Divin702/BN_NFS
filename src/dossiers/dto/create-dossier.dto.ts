import { IsUUID, IsOptional, IsString, IsInt, Min, IsBoolean, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DossierPartyDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  roleKey: string;

  @IsString()
  @IsNotEmpty()
  roleLabel: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateDossierDto {
  @ApiProperty({ description: 'UUID of the client' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'UUID of the assigned notary' })
  @IsOptional()
  @IsUUID()
  assignedNotaryId?: string;

  @ApiPropertyOptional({ description: 'Type of service (free text)' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Dossier description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'UUID of the notary service' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Notary fee in RWF (set by notary)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  notaryFee?: number;

  @ApiPropertyOptional({ description: 'Party roles for this dossier', type: [DossierPartyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DossierPartyDto)
  parties?: DossierPartyDto[];
}
