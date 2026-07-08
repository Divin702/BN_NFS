import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportsFilterDto } from './dto/reports-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRATOR, Role.NOTARY_PUBLIC)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Get filtered report data with summary stats' })
  getReport(@Query() filter: ReportsFilterDto, @CurrentUser() user: User) {
    return this.reportsService.getReport(filter, user);
  }
}
