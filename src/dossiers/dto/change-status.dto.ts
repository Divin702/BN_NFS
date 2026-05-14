import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DossierStatus } from '../entities/dossier.entity';

export class ChangeStatusDto {
  @ApiProperty({ enum: DossierStatus, description: 'New dossier status' })
  @IsEnum(DossierStatus)
  @IsNotEmpty()
  status: DossierStatus;
}
