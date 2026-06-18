import { Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from './enums/role.enum';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { UsersQueryDto } from './dto/users-query.dto';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRATOR)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('notaries')
  @Roles(Role.CLIENT, Role.NOTARY_PUBLIC, Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Public list of active notaries (for client portal)' })
  listNotaries() {
    return this.usersService.findNotaries();
  }

  @Get()
  @ApiOperation({ summary: 'List all users with search, filter, and pagination' })
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('my-clients')
  @Roles(Role.NOTARY_PUBLIC)
  @ApiOperation({ summary: 'List clients created by the authenticated notary' })
  myClients(@Query() query: UsersQueryDto, @Request() req: any) {
    return this.usersService.findMyClients(req.user.id, query);
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: 'Disable a user account' })
  disable(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.authService.disableUser(id, admin);
  }

  @Patch(':id/enable')
  @ApiOperation({ summary: 'Re-enable a disabled user account' })
  enable(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.authService.enableUser(id, admin);
  }

  @Patch(':id/resend-invitation')
  @ApiOperation({ summary: 'Resend invitation email (resets the 6-hour token)' })
  resend(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.authService.resendInvitation(id, admin);
  }
}
