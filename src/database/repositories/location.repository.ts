import { Injectable } from '@nestjs/common';
import type { Location, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Location[]> {
    return this.prisma.location.findMany({ orderBy: { name: 'asc' } });
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
