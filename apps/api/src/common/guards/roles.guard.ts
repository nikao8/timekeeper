import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import { HttpStatus } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types';
import { AppException } from '../errors/app.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user || !roles.includes(user.role)) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Você não possui permissão para acessar este recurso.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
