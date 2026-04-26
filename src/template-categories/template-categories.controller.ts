import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { TemplateCategoriesService } from './template-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Template Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('template-categories')
export class TemplateCategoriesController {
  constructor(private readonly svc: TemplateCategoriesService) {}

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC, Role.LEGAL_CLERK)
  @ApiOperation({ summary: 'List all categories' })
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC, Role.LEGAL_CLERK)
  @ApiOperation({ summary: 'Get single category' })
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Create category (admin only)' })
  create(@Body() dto: CreateCategoryDto) { return this.svc.create(dto); }

  @Patch(':id')
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Update category (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) { return this.svc.update(id, dto); }

  @Delete(':id')
  @Roles(Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Delete category (admin only)' })
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
