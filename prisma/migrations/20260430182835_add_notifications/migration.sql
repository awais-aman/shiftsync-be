-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'shift_assigned',
    'shift_unassigned',
    'shift_published',
    'shift_edited',
    'swap_requested',
    'swap_accepted',
    'swap_approved',
    'swap_rejected',
    'swap_cancelled',
    'swap_expired',
    'overtime_warning'
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "email_simulated" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS so the FE Realtime channel only delivers rows for the authenticated user.
-- The NestJS backend uses the service-role key, which bypasses RLS, so reads/writes from
-- the BE are unaffected.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
    ON "notifications"
    FOR SELECT
    USING (auth.uid() = user_id);

-- Add the notifications table to the supabase_realtime publication so postgres_changes
-- subscriptions deliver INSERT/UPDATE/DELETE events to the client.
ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";
