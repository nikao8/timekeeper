import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TimeBankTransactionType } from '@prisma/client';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DateTimeService } from '../common/datetime/datetime.service';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeAccessService } from '../employees/employee-access.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datetime: DateTimeService,
    private readonly access: EmployeeAccessService,
  ) {}

  @Get('time-bank.xlsx')
  @ApiOperation({ summary: 'Relatório Excel de banco de horas da equipe' })
  async timeBankExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') fromQuery?: string,
    @Query('to') toQuery?: string,
    @Query('month') month?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    if (employeeId) {
      await this.access.assertCanManage(user, employeeId);
    }
    const today = this.datetime.today();
    const from = month
      ? this.datetime.startOfMonth(`${month}-01`)
      : (fromQuery ?? this.datetime.startOfMonth(today));
    const to = month ? this.datetime.endOfMonth(`${month}-01`) : (toQuery ?? today);

    const employees = await this.prisma.employee.findMany({
      where: {
        managerId: user.employeeId,
        isActive: true,
        ...(employeeId ? { id: employeeId } : {}),
      },
      include: {
        timeBankTransactions: {
          where: {
            type: TimeBankTransactionType.DAILY_BALANCE,
            workDate: { gte: this.datetime.dateOnly(from), lte: this.datetime.dateOnly(to) },
          },
          orderBy: { workDate: 'asc' },
        },
        timeEntries: {
          where: {
            isActive: true,
            occurredAt: {
              gte: this.datetime.startOfDayUtc(from),
              lte: this.datetime.endOfDayUtc(to),
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Timekeeper';
    const sheet = workbook.addWorksheet('Banco de horas');
    sheet.columns = [
      { header: 'Funcionário', key: 'name', width: 28 },
      { header: 'Data', key: 'date', width: 14 },
      { header: 'Entrada', key: 'in', width: 12 },
      { header: 'Saída almoço', key: 'lunchOut', width: 14 },
      { header: 'Retorno almoço', key: 'lunchIn', width: 16 },
      { header: 'Saída', key: 'out', width: 12 },
      { header: 'Horas previstas', key: 'expected', width: 16 },
      { header: 'Horas trabalhadas', key: 'worked', width: 18 },
      { header: 'Horas extras', key: 'extra', width: 14 },
      { header: 'Horas negativas', key: 'negative', width: 16 },
      { header: 'Saldo do dia', key: 'day', width: 14 },
      { header: 'Saldo acumulado', key: 'acc', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const employee of employees) {
      for (const tx of employee.timeBankTransactions) {
        const iso = tx.workDate.toISOString().slice(0, 10);
        const start = this.datetime.startOfDayUtc(iso, employee.timezone);
        const end = this.datetime.endOfDayUtc(iso, employee.timezone);
        const dayEntries = employee.timeEntries.filter(
          (entry) => entry.occurredAt >= start && entry.occurredAt <= end,
        );
        const pick = (type: string) => {
          const found = dayEntries.find((entry) => entry.type === type);
          return found
            ? this.datetime.fromUtc(found.occurredAt, employee.timezone).toFormat('HH:mm')
            : '';
        };
        sheet.addRow({
          name: `${employee.firstName} ${employee.lastName}`,
          date: this.datetime.fromUtc(tx.workDate, employee.timezone).toFormat('dd/MM/yyyy'),
          in: pick('ENTRADA'),
          lunchOut: pick('SAIDA_ALMOCO'),
          lunchIn: pick('RETORNO_ALMOCO'),
          out: pick('SAIDA'),
          expected: this.datetime.formatDuration(tx.expectedMinutes, false),
          worked: this.datetime.formatDuration(tx.workedMinutes, false),
          extra: this.datetime.formatDuration(tx.extraMinutes, false),
          negative: this.datetime.formatDuration(tx.negativeMinutes, false),
          day: this.datetime.formatDuration(tx.deltaMinutes),
          acc: this.datetime.formatDuration(tx.balanceAfter),
        });
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="banco-de-horas.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }
}
