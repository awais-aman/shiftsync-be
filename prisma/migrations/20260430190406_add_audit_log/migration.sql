-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM (
    'shift',
    'shift_assignment',
    'swap_request',
    'overtime_override'
);

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
    'create',
    'update',
    'delete',
    'publish',
    'unpublish',
    'assign',
    'unassign',
    'swap_create',
    'swap_accept',
    'swap_approve',
    'swap_reject',
    'swap_cancel',
    'override_grant',
    'override_revoke'
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_location_id_created_at_idx" ON "audit_log"("location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);
