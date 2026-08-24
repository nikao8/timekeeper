import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ErrorCode, REFRESH_TOKEN_COOKIE } from '@timekeeper/shared';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { DateTimeService } from '../common/datetime/datetime.service';
import { AppConfigService } from '../config/app-config.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.types';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly mail: MailService,
    private readonly datetime: DateTimeService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, res: Response, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.logger.warn(`Failed login for ${email}`);
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'E-mail ou senha inválidos.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive || !user.employee?.isActive) {
      throw new AppException(
        ErrorCode.ACCOUNT_DISABLED,
        'Conta desativada. Contate o gestor.',
        HttpStatus.FORBIDDEN,
      );
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.employee.id);
    this.setRefreshCookie(res, tokens.refreshToken);
    this.logger.log(`Login succeeded for ${email}`);
    await this.audit.record({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: this.config.jwtExpiresIn,
      user: this.sanitizeUser(user),
    };
  }

  async logout(userId: string, refreshCookie: string | undefined, res: Response) {
    if (refreshCookie) {
      const parsed = this.parseCompositeToken(refreshCookie);
      if (parsed) {
        await this.prisma.refreshToken.updateMany({
          where: { id: parsed.id, userId, revokedAt: null },
          data: { revokedAt: this.datetime.nowUtc() },
        });
      }
    }
    this.clearRefreshCookie(res);
    this.logger.log(`Logout for user ${userId}`);
    return { loggedOut: true };
  }

  async refresh(refreshCookie: string | undefined, res: Response) {
    if (!refreshCookie) {
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Sessão expirada. Faça login novamente.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const parsed = this.parseCompositeToken(refreshCookie);
    if (!parsed) {
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Sessão inválida.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: { include: { employee: true } } },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < this.datetime.nowUtc() ||
      !(await argon2.verify(stored.tokenHash, parsed.secret))
    ) {
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Sessão expirada. Faça login novamente.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!stored.user.isActive || !stored.user.employee?.isActive) {
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, 'Conta desativada.', HttpStatus.FORBIDDEN);
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: this.datetime.nowUtc() },
    });

    const tokens = await this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.employee.id,
    );
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      expiresIn: this.config.jwtExpiresIn,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ accepted: true }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const secret = randomBytes(32).toString('hex');
      const tokenHash = await argon2.hash(secret);
      const expiresAt = new Date(
        Date.now() + this.parseDurationMs(this.config.passwordResetExpiresIn),
      );
      const record = await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      const resetUrl = `${this.config.appUrl}/reset-password?token=${record.id}.${secret}`;
      await this.mail.sendPasswordReset(email, resetUrl);
      this.logger.log(`Password reset requested for ${email}`);
    }
    return { accepted: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const parsed = this.parseCompositeToken(dto.token);
    if (!parsed) {
      throw new AppException(ErrorCode.INVALID_RESET_TOKEN, 'Token de recuperação inválido.');
    }
    const record = await this.prisma.passwordResetToken.findUnique({ where: { id: parsed.id } });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt < this.datetime.nowUtc() ||
      !(await argon2.verify(record.tokenHash, parsed.secret))
    ) {
      throw new AppException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Token de recuperação inválido ou expirado.',
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: this.datetime.nowUtc() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: this.datetime.nowUtc() },
      }),
    ]);
    this.logger.log(`Password reset completed for user ${record.userId}`);
    await this.audit.record({
      actorId: record.userId,
      action: 'AUTH_PASSWORD_RESET',
      entity: 'User',
      entityId: record.userId,
    });
    return { reset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Senha atual inválida.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: this.datetime.nowUtc() },
    });
    this.logger.log(`Password changed for user ${userId}`);
    await this.audit.record({
      actorId: userId,
      action: 'AUTH_PASSWORD_CHANGE',
      entity: 'User',
      entityId: userId,
    });
    return { changed: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (!user || !user.employee) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.sanitizeUser(user);
  }

  async validateUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (!user || !user.employee || !user.isActive || !user.employee.isActive) {
      throw new AppException(ErrorCode.UNAUTHORIZED, 'Sessão inválida.', HttpStatus.UNAUTHORIZED);
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee.id,
      isActive: user.isActive,
    };
  }

  private async issueTokens(userId: string, email: string, role: Role, employeeId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role, employeeId },
      { secret: this.config.jwtSecret, expiresIn: this.config.jwtExpiresIn as `${number}m` },
    );
    const secret = randomBytes(48).toString('hex');
    const tokenHash = await argon2.hash(secret);
    const expiresAt = new Date(Date.now() + this.parseDurationMs(this.config.jwtRefreshExpiresIn));
    const record = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { accessToken, refreshToken: `${record.id}.${secret}` };
  }

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? 'strict' : 'lax',
      path: '/auth',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth', httpOnly: true });
  }

  private parseCompositeToken(token: string): { id: string; secret: string } | null {
    const idx = token.indexOf('.');
    if (idx <= 0) {
      return null;
    }
    const id = token.slice(0, idx);
    const secret = token.slice(idx + 1);
    if (!id || !secret) {
      return null;
    }
    return { id, secret };
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 15 * 60 * 1000;
    }
    const amount = Number(match[1]);
    switch (match[2]) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      managerId: string | null;
      timezone: string;
      jobTitle: string | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      employee: user.employee
        ? {
            id: user.employee.id,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            fullName: `${user.employee.firstName} ${user.employee.lastName}`,
            managerId: user.employee.managerId,
            timezone: user.employee.timezone,
            jobTitle: user.employee.jobTitle,
          }
        : null,
    };
  }
}
