import { HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../auth/auth.types';
import { EmployeeAccessService } from './employee-access.service';

const gestorA: AuthUser = {
  id: 'user-a',
  email: 'gestor@example.com',
  role: Role.GESTOR,
  employeeId: 'emp-a',
  isActive: true,
};

const funcionario1: AuthUser = {
  id: 'user-1',
  email: 'funcionario@example.com',
  role: Role.FUNCIONARIO,
  employeeId: 'emp-1',
  isActive: true,
};

describe('EmployeeAccessService', () => {
  const prisma = {
    employee: {
      findUnique: jest.fn(),
    },
  };
  const service = new EmployeeAccessService(prisma as never);

  beforeEach(() => {
    prisma.employee.findUnique.mockReset();
  });

  it('allows a funcionário to access own data', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      managerId: 'emp-a',
      userId: 'user-1',
    });
    await expect(service.assertCanAccess(funcionario1, 'emp-1')).resolves.toBeDefined();
  });

  it('forbids a funcionário from accessing another employee (403)', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-2',
      managerId: 'emp-a',
      userId: 'user-2',
    });
    await expect(service.assertCanAccess(funcionario1, 'emp-2')).rejects.toMatchObject({
      errorCode: ErrorCode.FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    } as Partial<AppException>);
  });

  it('allows a gestor to access their own employee', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      managerId: 'emp-a',
      userId: 'user-1',
    });
    await expect(service.assertCanAccess(gestorA, 'emp-1')).resolves.toBeDefined();
  });

  it('forbids a gestor from accessing another manager team (403)', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-4',
      managerId: 'emp-b',
      userId: 'user-4',
    });
    await expect(service.assertCanAccess(gestorA, 'emp-4')).rejects.toMatchObject({
      errorCode: ErrorCode.CANNOT_MANAGE_EMPLOYEE,
      status: HttpStatus.FORBIDDEN,
    });
  });
});
