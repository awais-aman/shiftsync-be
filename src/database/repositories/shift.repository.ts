import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Location,
  type Shift,
  type Skill,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

export type ShiftWithRelations = Shift & {
  location: Location;
  requiredSkill: Skill;
};

export type ListShiftsFilters = {
  locationId?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class ShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: ListShiftsFilters = {}): Promise<ShiftWithRelations[]> {
    const where: Prisma.ShiftWhereInput = {};
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = filters.from;
      if (filters.to) where.startAt.lt = filters.to;
    }
    return this.prisma.shift.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { location: true, requiredSkill: true },
    });
  }

  findById(id: string): Promise<ShiftWithRelations | null> {
    return this.prisma.shift.findUnique({
      where: { id },
      include: { location: true, requiredSkill: true },
    });
  }

  create(data: Prisma.ShiftUncheckedCreateInput): Promise<ShiftWithRelations> {
    return this.prisma.shift.create({
      data,
      include: { location: true, requiredSkill: true },
    });
  }

  /**
   * Optimistic update: only writes if `version` matches. Returns null on mismatch.
   * Caller bumps version in `data.version`.
   */
  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: Prisma.ShiftUncheckedUpdateInput,
  ): Promise<ShiftWithRelations | null> {
    const result = await this.prisma.shift.updateMany({
      where: { id, version: expectedVersion },
      data,
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  delete(id: string): Promise<Shift> {
    return this.prisma.shift.delete({ where: { id } });
  }
}
