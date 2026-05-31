import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService) {
    this.isDev = config.get<string>('NODE_ENV') !== 'production';
  }

  async onModuleInit() {
    if (this.isDev) {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      this.logger.log(
        'Dev mail: Ethereal (fake SMTP) — a preview URL will be logged for every sent email',
      );
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.config.get('MAIL_HOST'),
        port: this.config.get<number>('MAIL_PORT'),
        secure: this.config.get<number>('MAIL_PORT') === 465,
        auth: {
          user: this.config.get('MAIL_USER'),
          pass: this.config.get('MAIL_PASS'),
        },
        tls: { rejectUnauthorized: false },
      });
    }
  }

  private async send(options: nodemailer.SendMailOptions): Promise<void> {
    const info = await this.transporter.sendMail(options);
    if (this.isDev) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      this.logger.log(`Preview email in browser → ${previewUrl}`);
    }
  }

  async sendPasswordReset(user: User, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/reset-password?token=${token}`;
    const fullName = `${user.firstName} ${user.lastName}`;

    const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:0}
  .wrapper{max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#0a66c2;padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:1px}
  .header p{color:#cce0f5;margin:6px 0 0;font-size:13px}
  .body{padding:36px 40px}
  .body h2{color:#0a66c2;font-size:18px;margin-top:0}
  .body p{color:#444;line-height:1.6;font-size:15px}
  .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#0a66c2;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold}
  .notice{background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:13px;color:#555}
  .footer{text-align:center;padding:20px 40px;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head>
<body>
  <div class="wrapper">
    <div class="header"><h1>NFS Notary File System</h1><p>Password Reset Request</p></div>
    <div class="body">
      <h2>Hello, ${fullName}</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <a href="${link}" class="btn" style="color:#ffffff !important; background:#0a66c2; text-decoration:none;"><span style="color:#ffffff !important;">Reset My Password</span></a>
      <div class="notice">
        <strong>This link expires in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email — your account is secure.
      </div>
      <p style="margin-top:24px;font-size:13px;color:#666;">Or paste this URL in your browser:<br/><span style="word-break:break-all;color:#0a66c2">${link}</span></p>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} NFS Notary File System. All rights reserved.</div>
  </div>
</body></html>`;

    try {
      await this.send({
        from: this.config.get('MAIL_FROM'),
        to: user.email,
        subject: 'Reset your NFS password',
        html,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset to ${user.email}`, err);
      throw err;
    }
  }

  async sendInvitation(user: User, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/accept-invitation?token=${token}`;
    const fullName = `${user.firstName} ${user.lastName}`;
    const roleLabel = user.role
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #1a3c6e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; }
    .header p { color: #a8bdd6; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; }
    .body h2 { color: #1a3c6e; font-size: 18px; margin-top: 0; }
    .body p { color: #444; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; margin: 24px 0; padding: 14px 32px; background: #1a3c6e; color: #fff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: bold; }
    .notice { background: #f0f4ff; border-left: 4px solid #1a3c6e; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #555; }
    .footer { text-align: center; padding: 20px 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NFS Notary File System</h1>
      <p>Official Platform Invitation</p>
    </div>
    <div class="body">
      <h2>Welcome, ${fullName}!</h2>
      <p>You have been invited to join the <strong>Notary File System (NFS)</strong> platform as a <strong>${roleLabel}</strong>.</p>
      <p>To activate your account and set your password, click the button below:</p>
      <a href="${link}" class="btn" style="color:#ffffff !important; background:#1a3c6e; text-decoration:none;"><span style="color:#ffffff !important;">Activate My Account</span></a>
      <div class="notice">
        <strong>Note:</strong> This invitation link will expire in <strong>72 hours</strong>. If you did not expect this invitation, you can safely ignore this email.
      </div>
      <p style="margin-top:24px;">If the button does not work, copy and paste this URL into your browser:</p>
      <p style="word-break:break-all; font-size:13px; color:#1a3c6e;">${link}</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} NFS Notary File System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

    try {
      await this.send({
        from: this.config.get('MAIL_FROM'),
        to: user.email,
        subject: `You're invited to NFS as ${roleLabel}`,
        html,
      });
      this.logger.log(`Invitation email sent to ${user.email}`);
    } catch (err) {
      this.logger.error(`Failed to send invitation to ${user.email}`, err);
      throw err;
    }
  }
}
