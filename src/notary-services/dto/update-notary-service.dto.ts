import { PartialType } from '@nestjs/swagger';
import { CreateNotaryServiceDto } from './create-notary-service.dto';

export class UpdateNotaryServiceDto extends PartialType(CreateNotaryServiceDto) {}
