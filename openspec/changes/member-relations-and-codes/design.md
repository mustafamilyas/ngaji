# Design

## Context

- `Member` belongs to a leaf group; scope is `group.path startsWith user.groupPath`. Members are soft-deleted and there is no restore. `PINDAH` re-creates a member as a new row (DESIGN.md §2 notes) until `member-group-move` replaces it with an in-place move.
- `MemberTag` is the model for link rows: hard-deleted, every change audited in the same transaction.
- `Organization` has no short identifier today. Organizations are created by `provisionOrganization` (`pnpm org:create`) and in the seed.
- SQLite: no enums, no partial indexes via Prisma, and `ALTER TABLE … ADD COLUMN` cannot add a `NOT NULL` column without a default to a table that already has rows.
- Member list search is `name contains` in `lib/member/queries.ts`.

## Goals / Non-Goals

**Goals:**
- One canonical row per relationship, so inverse views never drift.
- A code that is short enough for a card, safe to print and to encode as a QR later, and that never forces reprinting.
- Zero downtime on deploy: the migration runs with existing rows, and the backfill runs before the app starts.

**Non-Goals:**
- Deriving relatives (grandparents, in-laws), family trees, households.
- Treating the code as a secret. It is an identifier. Any future check-in that relies on it must add its own proof (e.g. an admin scanning, or a venue token).

## Decisions

### 1. `MemberRelation` with canonical direction
```prisma
model MemberRelation {
  id           Int      @id @default(autoincrement())
  fromMemberId Int      // ORANG_TUA/WALI: parent/guardian; symmetric: smaller id
  toMemberId   Int
  type         String   // RelationType: ORANG_TUA | WALI | PASANGAN | SAUDARA
  createdById  Int
  createdAt    DateTime @default(now())
  @@unique([fromMemberId, toMemberId])
  @@index([toMemberId])
}
```
- Symmetric types are stored with `fromMemberId < toMemberId`. Together with "one relationship per unordered pair", `@@unique([fromMemberId, toMemberId])` alone does **not** catch the reverse direction for directed types (B→A). That check lives in the mutation, inside the transaction: look up `(a,b)` or `(b,a)` before inserting. It is safe under SQLite's single-writer transactions.
- *Alternative*: store two rows (A→B parent, B→A child). Rejected: the two can drift, and every write and audit doubles.
- *Alternative*: a separate `Household` entity. Rejected for now: it is a different concept (who shares a phone or link) and belongs to the later self-attendance work.
- Labels are a pure function `relationLabel(type, side, relativeSex)` in `lib/member/relations.ts`, unit-tested first.

### 2. Authorization: `member.relate`
- One new action, used for both link and unlink. The target is the pair of resolved members; it is allowed only if both are non-deleted and in scope (the same predicate as `member.update` on each).
- Reading the Keluarga section needs no new action: the page already passed `member.view` for the viewed member. Relatives are loaded with a narrow `select` (id, name, sex, group name and path, deletedAt), and the path decides in-scope vs out-of-scope on the server. Out-of-scope relatives are serialized without `id`, so the client cannot even build a link.
- The picker is a server action `searchRelativeCandidates(memberId, query)`. It is scope-filtered, takes `RELATION_PICKER_LIMIT` (10) and selects only id, name, group name and code.

### 3. Member code: Crockford base32, 6 characters, org prefix
- 32⁶ ≈ 1.07 × 10⁹ codes per organization. At 10⁴ members the chance of a collision per insert is about 10⁻⁵, so a retry loop (`MEMBER_CODE_MAX_ATTEMPTS = 5`) is enough: inside the create transaction, generate the needed codes, look them up in one query (raw SQL, so soft-deleted members' codes count as taken), and regenerate only the taken ones. The same helper serves CSV import with one query per round. The unique index on `Member.code` stays as the backstop. Catching the violation and retrying was rejected: continuing a Prisma interactive transaction after a failed statement is fragile. Generation uses `crypto.randomInt`.
- Format `ANR-7K3MQ9` (10 characters) fits on a card and in a QR version 1. The prefix makes cards from different organizations distinguishable, and global uniqueness then reduces to per-prefix uniqueness. A DB unique index on `Member.code` still enforces it.
- *Alternative*: sequential numbers. Rejected: guessable, and they leak member counts (the user chose the prefix + random format).
- Normalization for search (`normalizeMemberCode`) is pure and tested: uppercase, strip whitespace and dashes, `O→0`, `I/L→1`, then, if the result is 8–10 characters, split it as "everything except the last 6 = prefix, last 6 = random part". The digit mapping applies only to the random part, because a prefix is letters only. It returns `PREFIX-XXXXXX` when the prefix is 2–4 letters and the random part is valid Crockford, otherwise `null` (not a code, so it is a name search only).
- The search adds `OR code = normalized` to the existing `name contains` condition, inside the same scope filter.

### 4. Nullable columns + mandatory backfill
- Migration: `Organization.memberCodePrefix String? @unique`, `Member.code String? @unique` (SQLite unique indexes allow multiple NULLs), plus the `MemberRelation` table.
- `scripts/member-codes-backfill.ts` (`pnpm member-codes:backfill <orgId>=<PREFIX> …`): sets missing prefixes from its arguments and refuses to run, changing nothing, if any organization would remain without one or an existing prefix would change (repeating the same prefix is allowed). It then runs one transaction per organization: set the prefix (audited as `organization.update`, before/after `memberCodePrefix`), assign codes to members where `code IS NULL` (soft-deleted included) in batches of `MEMBER_CODE_BACKFILL_BATCH`, and write one `member.code_backfill` entry (`meta: { count }`, only when codes were assigned). Actor = system (`null`), as in `org:create`. It is idempotent: a re-run writes nothing.
- In app code, `Member.code` is treated as required after the backfill. Creating a member in an organization without a prefix throws an internal error: logged without PII, generic message to the user.
- Seed: organizations get prefixes (`YNN` for Yayasan Ngaji Nusantara, `ANR` for the isolation org Majelis An-Nur); members get codes from the same backfill at the end of the seed (also run by the viewport-audit bulk seed). A few sample relationships are added with the Keluarga UI (tasks 6.2/6.3).
- *Alternative*: a two-step migration to make the columns `NOT NULL`. Deferred: `prisma migrate deploy` applies all pending migrations at once, so the backfill can't run between them in one release. A later release can tighten the columns.

### 5. Import and audit
- CSV import assigns codes inside its existing transaction. It ignores a `kode` column if present and does not add one to the template.
- `member.create` and `member.update` snapshots include `code`. New actions: `member.relate`, `member.unrelate`, `member.code_backfill`.

## Risks / Trade-offs

- [Code printed on a card can be photographed and reused] → The code is not an authenticator. The future check-in design must not accept a code alone for self check-in. This is noted in DESIGN.md §14.
- [Until `member-group-move` ships, a moved member is still re-created as a new row with a new code] → `member-group-move` follows directly and moves members in place, keeping their code. Old `PINDAH` duplicates keep their own codes (no merge).
- [Out-of-scope relative names are visible across branches] → This was the user's choice. Only name and group name are shown; birth date, phone and address are never sent. Linking still requires both members to be in scope.
- [Deploy forgets the backfill] → DEPLOYMENT.md step, release doc sanity check ("all members have a code"), and member creation fails loudly rather than silently creating code-less members.
- [Contradictions beyond a pair (A parent of B, B parent of C, C parent of A)] → Not checked. It is rare, harmless to the system and visible on the page. Only the per-pair rule is enforced.

## Migration Plan

1. Deploy the image with the migration (`prisma migrate deploy`).
2. Before starting the app: `pnpm member-codes:backfill 1=ANR …` for every existing organization.
3. Start the app. Sanity check: no member with `code IS NULL`; a new member gets a code; search by code works.
4. Rollback: the previous image ignores the new nullable columns and table, so it can run against the migrated DB.
