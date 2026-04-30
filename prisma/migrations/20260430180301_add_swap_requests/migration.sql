-- CreateEnum
CREATE TYPE "SwapType" AS ENUM ('swap', 'drop');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('pending', 'accepted_by_peer', 'approved', 'rejected', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "swap_requests" (
    "id" UUID NOT NULL,
    "type" "SwapType" NOT NULL,
    "requesting_assignment_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "target_staff_id" UUID,
    "target_assignment_id" UUID,
    "status" "SwapStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id"),
    -- Swaps require a peer; drops do not.
    CONSTRAINT "swap_requests_swap_has_peer_chk" CHECK (
        ("type" = 'drop')
        OR ("type" = 'swap' AND "target_staff_id" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "swap_requests_requester_id_status_idx" ON "swap_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "swap_requests_target_staff_id_status_idx" ON "swap_requests"("target_staff_id", "status");

-- CreateIndex
CREATE INDEX "swap_requests_status_idx" ON "swap_requests"("status");

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requesting_assignment_id_fkey" FOREIGN KEY ("requesting_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_assignment_id_fkey" FOREIGN KEY ("target_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_staff_id_fkey" FOREIGN KEY ("target_staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
