-- Required for combining UUID equality with tstzrange in an EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Mirror of the parent shift's [start, end) range. Maintained by triggers,
    -- because Postgres generated columns require IMMUTABLE expressions and
    -- can't reference other tables.
    "shift_range" TSTZRANGE,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_staff_id_key" ON "shift_assignments"("shift_id", "staff_id");

-- CreateIndex
CREATE INDEX "shift_assignments_staff_id_idx" ON "shift_assignments"("staff_id");

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger: populate shift_range from the parent shift on insert/update.
CREATE OR REPLACE FUNCTION sync_shift_assignment_range() RETURNS TRIGGER AS $$
BEGIN
  SELECT tstzrange(s.start_at, s.end_at, '[)') INTO NEW.shift_range
    FROM shifts s WHERE s.id = NEW.shift_id;
  IF NEW.shift_range IS NULL THEN
    RAISE EXCEPTION 'shift % not found while computing assignment range', NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shift_assignment_range_biu
  BEFORE INSERT OR UPDATE OF shift_id ON shift_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_shift_assignment_range();

-- Trigger: keep assignment ranges fresh when a shift's times change.
CREATE OR REPLACE FUNCTION resync_assignment_ranges_on_shift_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_at IS DISTINCT FROM OLD.start_at OR NEW.end_at IS DISTINCT FROM OLD.end_at THEN
    UPDATE shift_assignments
       SET shift_range = tstzrange(NEW.start_at, NEW.end_at, '[)')
     WHERE shift_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shifts_resync_assignment_ranges
  AFTER UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION resync_assignment_ranges_on_shift_change();

-- The marquee constraint: same staff cannot have two overlapping assignments.
-- Catches concurrent inserts at the DB level even when the BE constraint engine
-- raced with another transaction.
ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_no_double_booking"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    "shift_range" WITH &&
  );
