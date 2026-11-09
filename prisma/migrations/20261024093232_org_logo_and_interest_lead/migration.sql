-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "InterestLead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "memberCount" INTEGER,
    "message" TEXT,
    "consentAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InterestLead_createdAt_idx" ON "InterestLead"("createdAt");
