import { Injectable } from '@nestjs/common';
import type { OvertimeOverride, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class OvertimeOverrideRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForStaff(staffId: string): Promise<OvertimeOverride[]> {
    return this.prisma.overtimeOverride.findMany({
      where: { staffId },
      orderBy: { effectiveDate: 'asc' },
    });
  }

  findById(id: string): Promise<OvertimeOverride | null> {
    return this.prisma.overtimeOverride.findUnique({ where: { id } });
  }

  create(
    data: Prisma.OvertimeOverrideUncheckedCreateInput,
  ): Promise<OvertimeOverride> {
    return this.prisma.overtimeOverride.create({ data });
  }

  delete(id: string): Promise<OvertimeOverride> {
    return this.prisma.overtimeOverride.delete({ where: { id } });
  }
}
