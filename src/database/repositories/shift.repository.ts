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
  /** Hard scope; if set, results are restricted to these locations. */
  locationIdsAllowed?: string[];
  /** If true, only published shifts are returned. */
  publishedOnly?: boolean;
};

@Injectable()
export class ShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: ListShiftsFilters = {}): Promise<ShiftWithRelations[]> {
    const where: Prisma.ShiftWhereInput = {};
    if (filters.locationId && filters.locationIdsAllowed) {
      // Intersect: explicit filter must be in the allowed set, else empty.
      if (!filters.locationIdsAllowed.includes(filters.locationId)) {
        return Promise.resolve([]);
      }
      where.locationId = filters.locationId;
    } else if (filters.locationId) {
      where.locationId = filters.locationId;
    } else if (filters.locationIdsAllowed) {
      if (filters.locationIdsAllowed.length === 0) {
        return Promise.resolve([]);
      }
      where.locationId = { in: filters.locationIdsAllowed };
    }
    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = filters.from;
      if (filters.to) where.startAt.lt = filters.to;
    }
    if (filters.publishedOnly) {
      where.status = 'published';
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
