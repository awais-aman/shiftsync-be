-- CreateTable
CREATE TABLE "staff_certifications" (
    "staff_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_certifications_pkey" PRIMARY KEY ("staff_id", "location_id")
);

-- CreateIndex
CREATE INDEX "staff_certifications_location_id_idx" ON "staff_certifications"("location_id");

-- AddForeignKey
ALTER TABLE "staff_certifications" ADD CONSTRAINT "staff_certifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_certifications" ADD CONSTRAINT "staff_certifications_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "staff_skills" (
    "staff_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_skills_pkey" PRIMARY KEY ("staff_id", "skill_id")
);

-- CreateIndex
CREATE INDEX "staff_skills_skill_id_idx" ON "staff_skills"("skill_id");

-- AddForeignKey
ALTER TABLE "staff_skills" ADD CONSTRAINT "staff_skills_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_skills" ADD CONSTRAINT "staff_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "manager_locations" (
    "manager_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_locations_pkey" PRIMARY KEY ("manager_id", "location_id")
);

-- CreateIndex
CREATE INDEX "manager_locations_location_id_idx" ON "manager_locations"("location_id");

-- AddForeignKey
ALTER TABLE "manager_locations" ADD CONSTRAINT "manager_locations_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_locations" ADD CONSTRAINT "manager_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
