-- CreateTable
CREATE TABLE "availability_recurring" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_recurring_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "availability_recurring_weekday_chk" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "availability_recurring_start_format_chk" CHECK ("start_time" ~ '^[0-2][0-9]:[0-5][0-9]$'),
    CONSTRAINT "availability_recurring_end_format_chk" CHECK ("end_time" ~ '^[0-2][0-9]:[0-5][0-9]$'),
    CONSTRAINT "availability_recurring_end_after_start_chk" CHECK ("end_time" > "start_time")
);

-- CreateIndex
CREATE UNIQUE INDEX "availability_recurring_staff_id_weekday_start_time_timezone_key" ON "availability_recurring"("staff_id", "weekday", "start_time", "timezone");

-- CreateIndex
CREATE INDEX "availability_recurring_staff_id_idx" ON "availability_recurring"("staff_id");

-- AddForeignKey
ALTER TABLE "availability_recurring" ADD CONSTRAINT "availability_recurring_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_available" BOOLEAN NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "availability_exceptions_times_paired_chk" CHECK (
        ("start_time" IS NULL AND "end_time" IS NULL)
        OR ("start_time" IS NOT NULL AND "end_time" IS NOT NULL)
    ),
    CONSTRAINT "availability_exceptions_start_format_chk" CHECK (
        "start_time" IS NULL OR "start_time" ~ '^[0-2][0-9]:[0-5][0-9]$'
    ),
    CONSTRAINT "availability_exceptions_end_format_chk" CHECK (
        "end_time" IS NULL OR "end_time" ~ '^[0-2][0-9]:[0-5][0-9]$'
    ),
    CONSTRAINT "availability_exceptions_end_after_start_chk" CHECK (
        "start_time" IS NULL OR "end_time" > "start_time"
    )
);

-- CreateIndex
CREATE INDEX "availability_exceptions_staff_id_date_idx" ON "availability_exceptions"("staff_id", "date");

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
