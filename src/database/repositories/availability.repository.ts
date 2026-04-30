import { Injectable } from '@nestjs/common';
import type {
  AvailabilityException,
  AvailabilityRecurring,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  listRecurring(staffId: string): Promise<AvailabilityRecurring[]> {
    return this.prisma.availabilityRecurring.findMany({
      where: { staffId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }

  findRecurringById(id: string): Promise<AvailabilityRecurring | null> {
    return this.prisma.availabilityRecurring.findUnique({ where: { id } });
  }

  createRecurring(
    data: Prisma.AvailabilityRecurringUncheckedCreateInput,
  ): Promise<AvailabilityRecurring> {
    return this.prisma.availabilityRecurring.create({ data });
  }

  updateRecurring(
    id: string,
    data: Prisma.AvailabilityRecurringUncheckedUpdateInput,
  ): Promise<AvailabilityRecurring> {
    return this.prisma.availabilityRecurring.update({ where: { id }, data });
  }

  deleteRecurring(id: string): Promise<AvailabilityRecurring> {
    return this.prisma.availabilityRecurring.delete({ where: { id } });
  }

  listExceptions(staffId: string): Promise<AvailabilityException[]> {
    return this.prisma.availabilityException.findMany({
      where: { staffId },
      orderBy: { date: 'asc' },
    });
  }

  findExceptionById(id: string): Promise<AvailabilityException | null> {
    return this.prisma.availabilityException.findUnique({ where: { id } });
  }

  createException(
    data: Prisma.AvailabilityExceptionUncheckedCreateInput,
  ): Promise<AvailabilityException> {
    return this.prisma.availabilityException.create({ data });
  }

  updateException(
    id: string,
    data: Prisma.AvailabilityExceptionUncheckedUpdateInput,
  ): Promise<AvailabilityException> {
    return this.prisma.availabilityException.update({ where: { id }, data });
  }

  deleteException(id: string): Promise<AvailabilityException> {
    return this.prisma.availabilityException.delete({ where: { id } });
  }
}
