-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'in_app_email');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "notification_channel" "NotificationChannel" NOT NULL DEFAULT 'in_app_email';
