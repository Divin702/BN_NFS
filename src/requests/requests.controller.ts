import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Client submits a notarization request' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get requests — clients see own, notaries see assigned, admin sees all' })
  findAll(@CurrentUser() user: User) {
    return this.service.findForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single request by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Notary accepts/declines/completes a request' })
  update(@Param('id') id: string, @Body() dto: UpdateRequestDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Client cancels a pending request' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }
}
