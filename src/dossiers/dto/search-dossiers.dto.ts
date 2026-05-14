import { IsEnum, IsOptional, IsString, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DossierStatus } from '../entities/dossier.entity';

export class SearchDossiersDto {
  @ApiPropertyOptional({ description: 'Search query (number, client name, nationalId)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: DossierStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(DossierStatus)
  status?: DossierStatus;

  @ApiPropertyOptional({ description: 'Filter by client UUID' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned notary UUID' })
  @IsOptional()
  @IsUUID()
  assignedNotaryId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
