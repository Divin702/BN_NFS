import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { DocumentTemplatesService } from './document-templates.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { QueryDocumentTemplateDto } from './dto/query-document-template.dto';

@ApiTags('Document Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly svc: DocumentTemplatesService) {}

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC, Role.LEGAL_CLERK)
  @ApiOperation({ summary: 'List templates with filters and pagination' })
  findAll(@Query() query: QueryDocumentTemplateDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC, Role.LEGAL_CLERK)
  @ApiOperation({ summary: 'Get single template' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Create template (admin only)' })
  create(@Body() dto: CreateDocumentTemplateDto, @Request() req: any) {
    return this.svc.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Update template — auto-increments patch version (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Delete template (admin only)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
