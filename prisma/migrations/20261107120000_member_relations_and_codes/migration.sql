-- AlterTable
ALTER TABLE "Member" ADD COLUMN "code" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "memberCodePrefix" TEXT;

-- CreateTable
CREATE TABLE "MemberRelation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromMemberId" INTEGER NOT NULL,
    "toMemberId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberRelation_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberRelation_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberRelation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MemberRelation_toMemberId_idx" ON "MemberRelation"("toMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRelation_fromMemberId_toMemberId_key" ON "MemberRelation"("fromMemberId", "toMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_code_key" ON "Member"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_memberCodePrefix_key" ON "Organization"("memberCodePrefix");

