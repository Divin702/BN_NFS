import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportsFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'completed', 'archived'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedNotaryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
