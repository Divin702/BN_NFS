import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { Role } from '../users/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async registerClient(dto: {
    firstName: string;
    lastName: string;
    email: string;
    nationalId: string;
    phoneNumber: string;
    password: string;
  }) {
    await this.assertUnique(dto.email, dto.nationalId, dto.phoneNumber);
    const user = this.usersService.create({
      ...dto,
      role: Role.CLIENT,
      isActive: true,
    });
    const saved = await this.usersService.save(user);
    return this.buildTokenResponse(saved);
  }

  async saveSignature(userId: string, signatureUrl: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.signature = signatureUrl;
    const saved = await this.usersService.save(user);
    const { password, invitationToken, ...safe } = saved;
    return safe;
  }

  async login(dto: LoginDto) {
    const user =
      (await this.usersService.findByEmail(dto.identifier)) ??
      (await this.usersService.findByNationalId(dto.identifier));

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) throw new UnauthorizedException('Account not activated yet');
    if (!user.isActive) throw new UnauthorizedException('Account is not active');

    const valid = await user.validatePassword(dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokenResponse(user);
  }

  async inviteUser(dto: InviteUserDto, admin: User) {
    if (admin.role !== Role.ADMINISTRATOR) {
      throw new UnauthorizedException('Only administrators can send invitations');
    }
    await this.assertUnique(dto.email, dto.nationalId, dto.phoneNumber);

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours

    const user = this.usersService.create({
      ...dto,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      isActive: false,
    });
    const saved = await this.usersService.save(user);

    try {
      await this.mailService.sendInvitation(saved, token);
    } catch (err) {
      // Roll back the user — admin sees a clean error and can retry
      await this.usersService.remove(saved.id);
      throw new ServiceUnavailableException(
        'Could not send the invitation email. Please check the SMTP configuration and try again.',
      );
    }

    return { message: `Invitation sent to ${dto.email}` };
  }

  async setPassword(dto: SetPasswordDto) {
    const user = await this.usersService.findByInvitationToken(dto.token);

    if (!user) throw new NotFoundException('Invalid or expired invitation link');
    if (user.invitationExpiresAt < new Date()) {
      throw new BadRequestException('This invitation link has expired. Please contact your administrator.');
    }
    if (user.invitationAccepted) {
      throw new BadRequestException('This invitation has already been used');
    }

    user.password = dto.password;
    user.isActive = true;
    user.invitationAccepted = true;
    user.invitationToken = null;
    await this.usersService.save(user);

    return this.buildTokenResponse(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, dto);
    return this.usersService.save(user);
  }

  async getProfile(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const { password, invitationToken, ...safe } = user;
    return safe;
  }

  async disableUser(id: string, admin: User) {
    if (admin.role !== Role.ADMINISTRATOR) throw new UnauthorizedException();
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === admin.id) throw new BadRequestException('You cannot disable your own account');
    user.isDisabled = true;
    await this.usersService.save(user);
    return { message: `${user.firstName} ${user.lastName} has been disabled` };
  }

  async enableUser(id: string, admin: User) {
    if (admin.role !== Role.ADMINISTRATOR) throw new UnauthorizedException();
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.isDisabled = false;
    await this.usersService.save(user);
    return { message: `${user.firstName} ${user.lastName} has been enabled` };
  }

  async resendInvitation(id: string, admin: User) {
    if (admin.role !== Role.ADMINISTRATOR) throw new UnauthorizedException();
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.invitationAccepted) throw new BadRequestException('User has already accepted the invitation');

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    user.invitationToken = token;
    user.invitationExpiresAt = expiresAt;
    await this.usersService.save(user);

    try {
      await this.mailService.sendInvitation(user, token);
    } catch (err) {
      throw new ServiceUnavailableException(
        'Could not resend the invitation email. Please check the SMTP configuration and try again.',
      );
    }
    return { message: `Invitation resent to ${user.email}` };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    // Always return success — never reveal whether an email exists
    if (!user || !user.isActive || user.isDisabled) {
      return { message: 'If that email is registered, a reset link has been sent.' };
    }

    const token = uuidv4();
    user.passwordResetToken = token;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersService.save(user);

    await this.mailService.sendPasswordReset(user, token);
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByPasswordResetToken(dto.token);

    if (!user || !user.passwordResetToken) {
      throw new BadRequestException('This reset link is invalid or has already been used.');
    }
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Please request a new one.');
    }

    user.password = dto.password;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.usersService.save(user);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new BadRequestException('Your account does not have a password set yet.');
    }

    const valid = await user.validatePassword(dto.currentPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect.');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from your current password.');
    }

    user.password = dto.newPassword;
    await this.usersService.save(user);

    return { message: 'Password changed successfully.' };
  }

  private async assertUnique(email: string, nationalId: string, phoneNumber: string) {
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email is already registered');
    }
    if (await this.usersService.findByNationalId(nationalId)) {
      throw new ConflictException('National ID is already registered');
    }
    if (await this.usersService.findByPhoneNumber(phoneNumber)) {
      throw new ConflictException('Phone number is already registered');
    }
  }

  private buildTokenResponse(user: User) {
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    const { password, invitationToken, ...profile } = user;
    return { accessToken: token, user: profile };
  }
}
