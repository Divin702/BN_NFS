import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DossiersService } from './dossiers.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { SearchDossiersDto } from './dto/search-dossiers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Dossiers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list dossiers with pagination' })
  findAll(@Query() query: SearchDossiersDto, @CurrentUser() user: User) {
    if (user.role === Role.NOTARY_PUBLIC) {
      query.assignedNotaryId = user.id;
    }
    return this.dossiersService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new dossier' })
  create(@Body() dto: CreateDossierDto, @CurrentUser() user: User) {
    return this.dossiersService.create(dto, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dossier counts by status, optionally filtered by date range' })
  getStats(
    @CurrentUser() user: User,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const notaryId = user.role === Role.NOTARY_PUBLIC ? user.id : undefined;
    return this.dossiersService.getStats(notaryId, dateFrom, dateTo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single dossier by ID' })
  findOne(@Param('id') id: string) {
    return this.dossiersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a dossier' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDossierDto,
    @CurrentUser() user: User,
  ) {
    return this.dossiersService.update(id, dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change dossier status' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.dossiersService.changeStatus(id, dto.status, user);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Add a document to a dossier' })
  addDocument(@Param('id') id: string, @Body() dto: AddDocumentDto) {
    return this.dossiersService.addDocument(id, dto);
  }

  @Delete(':id/documents')
  @ApiOperation({ summary: 'Remove a document from a dossier by URL' })
  @ApiQuery({ name: 'url', required: true, description: 'URL of the document to remove' })
  removeDocument(@Param('id') id: string, @Query('url') url: string) {
    return this.dossiersService.removeDocument(id, url);
  }

  @Put(':id/parties')
  @ApiOperation({ summary: 'Replace all parties on a dossier' })
  updateParties(@Param('id') id: string, @Body() body: { parties: any[] }) {
    return this.dossiersService.updateParties(id, body.parties);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Delete a dossier (Admin only)' })
  remove(@Param('id') id: string) {
    return this.dossiersService.remove(id);
  }
}
