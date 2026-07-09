import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SaveFingerprintDto {
  @ApiProperty({ description: 'Base64-encoded fingerprint template from DigitalPersona WebSDK' })
  @IsString()
  @IsNotEmpty()
  template: string;
}

class IdentifyFingerprintDto {
  @ApiProperty({ description: 'Base64-encoded fingerprint sample captured by DigitalPersona WebSDK' })
  @IsString()
  @IsNotEmpty()
  sample: string;
}
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { SearchClientsDto } from './dto/search-clients.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list clients with pagination' })
  findAll(@Query() query: SearchClientsDto, @CurrentUser() user: User) {
    const notaryId = user.role === Role.NOTARY_PUBLIC ? user.id : undefined;
    return this.clientsService.findAll(query, notaryId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: User) {
    const createdByNotaryId = user.role === Role.NOTARY_PUBLIC ? user.id : undefined;
    return this.clientsService.create(dto, createdByNotaryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single client by ID' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC)
  @ApiOperation({ summary: 'Delete a client (Admin or Notary)' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Post('fingerprint/identify')
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC)
  @ApiOperation({ summary: 'Identify a client by fingerprint sample — 1:N match against all enrolled templates' })
  identifyFingerprint(@Body() dto: IdentifyFingerprintDto) {
    return this.clientsService.identifyFingerprint(dto.sample);
  }

  @Get('fingerprints/templates')
  @ApiOperation({ summary: 'Get all enrolled fingerprint templates' })
  getAllFingerprintTemplates() {
    return this.clientsService.getAllFingerprintTemplates();
  }

  @Post(':id/fingerprint')
  @ApiOperation({ summary: 'Save an enrolled fingerprint template for a client' })
  saveFingerprint(@Param('id') id: string, @Body() dto: SaveFingerprintDto) {
    return this.clientsService.saveFingerprint(id, dto.template);
  }

  @Delete(':id/fingerprint')
  @ApiOperation({ summary: 'Remove the fingerprint template for a client' })
  removeFingerprint(@Param('id') id: string) {
    return this.clientsService.removeFingerprint(id);
  }
}
