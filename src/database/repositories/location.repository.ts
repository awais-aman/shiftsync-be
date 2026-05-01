import { Injectable } from '@nestjs/common';
import type { Location, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: { idsAllowed?: string[] } = {}): Promise<Location[]> {
    const where: Prisma.LocationWhereInput = {};
    if (filters.idsAllowed) {
      if (filters.idsAllowed.length === 0) return Promise.resolve([]);
      where.id = { in: filters.idsAllowed };
    }
    return this.prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string): Promise<Location | null> {
    return this.prisma.location.findUnique({ where: { id } });
  }

  create(data: Prisma.LocationCreateInput): Promise<Location> {
    return this.prisma.location.create({ data });
  }

  update(id: string, data: Prisma.LocationUpdateInput): Promise<Location> {
    return this.prisma.location.update({ where: { id }, data });
  }

  delete(id: string): Promise<Location> {
    return this.prisma.location.delete({ where: { id } });
  }
}
