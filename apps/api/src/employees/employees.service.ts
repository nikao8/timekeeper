import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, QueryEmployeesDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeeAccessService } from './employee-access.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: QueryEmployeesDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...this.access.teamFilter(user),
    };
    if (query.isActive === 'true') {
      where.isActive = true;
    }
    if (query.isActive === 'false') {
      where.isActive = false;
    }
    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { user: { email: { contains: q } } },
        { document: { contains: q } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        timeBank: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return employees.map((employee) => this.toDto(employee));
  }

  async get(user: AuthUser, employeeId: string) {
    const employee = await this.access.assertCanAccess(user, employeeId);
    const full = await this.prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        timeBank: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return this.toDto(full!);
  }

  async create(user: AuthUser, dto: CreateEmployeeDto) {
    if (user.role !== Role.GESTOR) {
      throw new AppException(
        ErrorCode.MANAGER_REQUIRED,
        'Apenas gestores podem criar funcionários.',
        HttpStatus.FORBIDDEN,
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppException(
        ErrorCode.CONFLICT,
        'Já existe um usuário com este e-mail.',
        HttpStatus.CONFLICT,
      );
    }

    const managerId = dto.managerId ?? user.employeeId;
    if (managerId !== user.employeeId) {
      await this.access.assertCanManage(user, managerId);
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: dto.role ?? Role.FUNCIONARIO,
        },
      });
      const employee = await tx.employee.create({
        data: {
          userId: newUser.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          document: dto.document,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          hireDate: dto.hireDate ? this.datetime.dateOnly(dto.hireDate) : undefined,
          managerId,
          timezone: dto.timezone ?? 'America/Sao_Paulo',
        },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
          timeBank: true,
        },
      });
      await tx.timeBank.create({ data: { employeeId: employee.id, balanceMinutes: 0 } });
      await tx.vacationBalance.create({
        data: {
          employeeId: employee.id,
          year: Number(this.datetime.today().slice(0, 4)),
          entitledDays: 30,
          usedDays: 0,
        },
      });
      return employee;
    });

    this.logger.log(`Employee ${created.id} created by ${user.id}`);
    await this.audit.record({
      actorId: user.id,
      action: 'EMPLOYEE_CREATE',
      entity: 'Employee',
      entityId: created.id,
      after: { email, firstName: dto.firstName, lastName: dto.lastName },
    });
    return this.toDto(created);
  }

  async update(user: AuthUser, employeeId: string, dto: UpdateEmployeeDto) {
    const current = await this.access.assertCanManage(user, employeeId);
    if (dto.managerId && dto.managerId !== user.employeeId && dto.managerId !== employeeId) {
      await this.access.assertCanAccess(user, dto.managerId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.role !== undefined || dto.isActive !== undefined) {
        await tx.user.update({
          where: { id: current.userId },
          data: {
            ...(dto.role !== undefined ? { role: dto.role } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
      }
      return tx.employee.update({
        where: { id: employeeId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          document: dto.document,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          hireDate: dto.hireDate ? this.datetime.dateOnly(dto.hireDate) : undefined,
          managerId: dto.managerId === undefined ? undefined : dto.managerId,
          timezone: dto.timezone,
          isActive: dto.isActive,
        },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
          timeBank: true,
        },
      });
    });

    await this.audit.record({
      actorId: user.id,
      action: 'EMPLOYEE_UPDATE',
      entity: 'Employee',
      entityId: employeeId,
      before: {
        firstName: current.firstName,
        lastName: current.lastName,
        isActive: current.isActive,
        managerId: current.managerId,
      },
      after: dto as Prisma.InputJsonValue,
    });
    return this.toDto(updated);
  }

  private toDto(employee: {
    id: string;
    firstName: string;
    lastName: string;
    document: string | null;
    phone: string | null;
    jobTitle: string | null;
    hireDate: Date | null;
    timezone: string;
    isActive: boolean;
    managerId: string | null;
    user: { id: string; email: string; role: Role; isActive: boolean };
    timeBank: { balanceMinutes: number } | null;
    manager?: { id: string; firstName: string; lastName: string } | null;
  }) {
    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: `${employee.firstName} ${employee.lastName}`,
      document: employee.document,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      hireDate: employee.hireDate,
      timezone: employee.timezone,
      isActive: employee.isActive && employee.user.isActive,
      managerId: employee.managerId,
      manager: employee.manager
        ? {
            id: employee.manager.id,
            fullName: `${employee.manager.firstName} ${employee.manager.lastName}`,
          }
        : null,
      user: employee.user,
      timeBankMinutes: employee.timeBank?.balanceMinutes ?? 0,
    };
  }
}
