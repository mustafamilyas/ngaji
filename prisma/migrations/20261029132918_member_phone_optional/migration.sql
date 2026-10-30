-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "maritalStatus" TEXT NOT NULL,
    "workStatus" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "joinedAt" TEXT NOT NULL,
    "exitedAt" TEXT,
    "deletedAt" DATETIME,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("address", "birthDate", "birthPlace", "createdAt", "createdById", "deletedAt", "email", "exitedAt", "groupId", "id", "joinedAt", "maritalStatus", "name", "phone", "sex", "status", "updatedAt", "workStatus") SELECT "address", "birthDate", "birthPlace", "createdAt", "createdById", "deletedAt", "email", "exitedAt", "groupId", "id", "joinedAt", "maritalStatus", "name", "phone", "sex", "status", "updatedAt", "workStatus" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_groupId_status_idx" ON "Member"("groupId", "status");
CREATE INDEX "Member_name_idx" ON "Member"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
