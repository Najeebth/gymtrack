-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- DataMigration: fold the single shared Admin account into User as role
-- ADMIN, preserving its id/password hash so its JWTs stay structurally
-- meaningful (holders will still need to re-login once the payload shape
-- changes, but no data is lost).
INSERT INTO "User" ("id", "email", "password", "role", "createdAt")
SELECT "id", "username", "password", 'ADMIN', "createdAt" FROM "Admin";

-- AlterTable: add userId as nullable first so we can backfill existing rows
-- before enforcing NOT NULL (Workout had no user association at all before
-- this migration — every pre-existing row is attributed to the admin user
-- rather than dropped or orphaned).
ALTER TABLE "Workout" ADD COLUMN "userId" TEXT;

-- DataMigration: attribute all pre-existing workouts (logged before
-- multi-user accounts existed) to the admin user.
UPDATE "Workout" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);

-- AlterTable: now safe to require userId on every workout going forward
ALTER TABLE "Workout" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable: superseded by User (role = ADMIN)
DROP TABLE "Admin";
