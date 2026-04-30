-- CreateTable
CREATE TABLE "overtime_overrides" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_overrides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overtime_overrides_reason_not_blank_chk" CHECK (length(btrim("reason")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "overtime_overrides_staff_id_effective_date_key" ON "overtime_overrides"("staff_id", "effective_date");

-- CreateIndex
CREATE INDEX "overtime_overrides_staff_id_idx" ON "overtime_overrides"("staff_id");

-- AddForeignKey
ALTER TABLE "overtime_overrides" ADD CONSTRAINT "overtime_overrides_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_overrides" ADD CONSTRAINT "overtime_overrides_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
