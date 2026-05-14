import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateDossierDto } from './create-dossier.dto';
import { DossierStatus } from '../entities/dossier.entity';

export class UpdateDossierDto extends PartialType(CreateDossierDto) {
  @ApiPropertyOptional({ enum: DossierStatus, description: 'New status' })
  @IsOptional()
  @IsEnum(DossierStatus)
  status?: DossierStatus;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
