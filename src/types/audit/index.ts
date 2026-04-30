import type { AuditAction, AuditEntityType } from '@prisma/client';

export type AuditEntry = {
  id: string;
  actorId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  locationId?: string | null;
  createdAt: string;
};
