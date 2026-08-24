import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get apiPort(): number {
    return Number(this.config.get('API_PORT', this.config.get('PORT', 3001)));
  }

  get databaseUrl(): string {
    return this.require('DATABASE_URL');
  }

  get jwtSecret(): string {
    return this.require('JWT_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.require('JWT_REFRESH_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.config.get<string>('JWT_EXPIRES_IN', '15m');
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  get appUrl(): string {
    return this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  get apiUrl(): string {
    return this.config.get<string>('API_URL', 'http://localhost:3001');
  }

  get defaultTimezone(): string {
    return this.config.get<string>('DEFAULT_TIMEZONE', 'America/Sao_Paulo');
  }

  get corsOrigins(): string[] {
    return this.config
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get passwordResetExpiresIn(): string {
    return this.config.get<string>('PASSWORD_RESET_EXPIRES_IN', '1h');
  }

  get smtp() {
    return {
      host: this.config.get<string>('SMTP_HOST') ?? '',
      port: Number(this.config.get('SMTP_PORT', 587)),
      user: this.config.get<string>('SMTP_USER') ?? '',
      password: this.config.get<string>('SMTP_PASSWORD') ?? '',
      from: this.config.get<string>('SMTP_FROM', 'Timekeeper <noreply@localhost>'),
    };
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
}
