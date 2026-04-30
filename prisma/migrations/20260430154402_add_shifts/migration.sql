-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "required_skill_id" UUID NOT NULL,
    "headcount" INTEGER NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShiftStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shifts_end_after_start_chk" CHECK ("end_at" > "start_at"),
    CONSTRAINT "shifts_headcount_positive_chk" CHECK ("headcount" > 0)
);

-- CreateIndex
CREATE INDEX "shifts_location_id_start_at_idx" ON "shifts"("location_id", "start_at");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_required_skill_id_fkey" FOREIGN KEY ("required_skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
