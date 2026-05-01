import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuditAction, AuditEntityType, AuditLog } from '@prisma/client';
import {
  AuditRepository,
  type ListAuditFilters,
} from '@/database/repositories/audit.repository';
import { AuditEntryDto } from '@/audit/dto/audit-entry.dto';
import { LocationScopeService } from '@/common/scope/location-scope.service';

export type RecordAuditInput = {
  actorId?: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  locationId?: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly scopeService: LocationScopeService,
  ) {}

  /** Fire-and-forget; never throws. Audit failures are logged but don't break callers. */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditRepository.create({
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: input.before as never,
        after: input.after as never,
        locationId: input.locationId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry for ${input.entityType}:${input.entityId} ${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(filters: ListAuditFilters): Promise<AuditEntryDto[]> {
    const rows = await this.auditRepository.list(filters);
    return rows.map((row) => this.toDto(row));
  }

  /** Apply manager-location scope on top of the requested filters. */
  async listForActor(
    filters: ListAuditFilters,
    actorId: string,
  ): Promise<AuditEntryDto[]> {
    const scoped = await this.applyScope(filters, actorId);
    return this.list(scoped);
  }

  async listRawForActor(
    filters: ListAuditFilters,
    actorId: string,
  ): Promise<AuditLog[]> {
    const scoped = await this.applyScope(filters, actorId);
    return this.auditRepository.list(scoped);
  }

  async listRaw(filters: ListAuditFilters): Promise<AuditLog[]> {
    return this.auditRepository.list(filters);
  }

  private async applyScope(
    filters: ListAuditFilters,
    actorId: string,
  ): Promise<ListAuditFilters> {
    const ctx = await this.scopeService.contextFor(actorId);
    if (ctx.role === UserRole.admin) return filters;
    return { ...filters, locationIdsAllowed: ctx.managedLocationIds ?? [] };
  }

  private toDto(row: AuditLog): AuditEntryDto {
    return {
      id: row.id,
      actorId: row.actorId,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      before: row.before,
      after: row.after,
      locationId: row.locationId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  toCsv(rows: AuditLog[]): string {
    const header = [
      'created_at',
      'actor_id',
      'entity_type',
      'entity_id',
      'action',
      'location_id',
      'before',
      'after',
    ].join(',');
    const lines = rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.actorId ?? '',
        row.entityType,
        row.entityId,
        row.action,
        row.locationId ?? '',
        csvCell(row.before),
        csvCell(row.after),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  // Escape any embedded double-quotes per RFC 4180 and wrap.
  return `"${json.replace(/"/g, '""')}"`;
}
