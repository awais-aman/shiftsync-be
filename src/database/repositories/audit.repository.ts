import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

export type ListAuditFilters = {
  entityType?: AuditLog['entityType'];
  entityId?: string;
  action?: AuditLog['action'];
  actorId?: string;
  locationId?: string;
  /** Hard scope; if set, results are restricted to these locations. */
  locationIdsAllowed?: string[];
  from?: Date;
  to?: Date;
  limit?: number;
};

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: ListAuditFilters = {}): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.locationId && filters.locationIdsAllowed) {
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
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lt = filters.to;
    }
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 500,
    });
  }

  create(
    data: Prisma.AuditLogUncheckedCreateInput,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }
}
