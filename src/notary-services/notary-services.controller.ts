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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotaryServicesService } from './notary-services.service';
import { CreateNotaryServiceDto } from './dto/create-notary-service.dto';
import { UpdateNotaryServiceDto } from './dto/update-notary-service.dto';
import { SearchNotaryServicesDto } from './dto/search-notary-services.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';

@ApiTags('Notary Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notary-services')
export class NotaryServicesController {
  constructor(private readonly notaryServicesService: NotaryServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List and search notary services' })
  findAll(@Query() query: SearchNotaryServicesDto) {
    return this.notaryServicesService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Create a new notary service (Admin only)' })
  create(@Body() dto: CreateNotaryServiceDto) {
    return this.notaryServicesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notary service by ID' })
  findOne(@Param('id') id: string) {
    return this.notaryServicesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Update a notary service (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateNotaryServiceDto) {
    return this.notaryServicesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Delete a notary service (Admin only)' })
  remove(@Param('id') id: string) {
    return this.notaryServicesService.remove(id);
  }
}
