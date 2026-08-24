import { HttpStatus, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import type { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isSelf(user: AuthUser, employeeId: string): boolean {
    return user.employeeId === employeeId;
  }

  async assertCanAccess(user: AuthUser, employeeId: string) {
    if (this.isSelf(user, employeeId)) {
      return this.requireEmployee(employeeId);
    }
    if (user.role !== Role.GESTOR) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Você não pode acessar dados de outro funcionário.',
        HttpStatus.FORBIDDEN,
      );
    }
    const employee = await this.requireEmployee(employeeId);
    if (employee.managerId !== user.employeeId) {
      throw new AppException(
        ErrorCode.CANNOT_MANAGE_EMPLOYEE,
        'Este funcionário não pertence à sua equipe.',
        HttpStatus.FORBIDDEN,
      );
    }
    return employee;
  }

  async assertCanManage(user: AuthUser, employeeId: string) {
    if (user.role !== Role.GESTOR) {
      throw new AppException(
        ErrorCode.MANAGER_REQUIRED,
        'Apenas gestores podem realizar esta ação.',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.assertCanAccess(user, employeeId);
  }

  teamFilter(user: AuthUser) {
    return { managerId: user.employeeId };
  }

  async requireEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });
    if (!employee) {
      throw new AppException(
        ErrorCode.EMPLOYEE_NOT_FOUND,
        'Funcionário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return employee;
  }
}
