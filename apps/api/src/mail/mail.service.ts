import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: AppConfigService) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const smtp = this.config.smtp;
    if (!smtp.host) {
      this.logger.log(`[DEV] Password reset for ${email}: ${resetUrl}`);
      return;
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Redefinição de senha — Timekeeper',
      text: `Use o link a seguir para redefinir sua senha (expira em breve):\n\n${resetUrl}`,
      html: `<p>Use o link a seguir para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}
