# Proposal

## Why

Groups in different branches regularly hold one activity together (e.g. two kelompok from different desa run a joint pengajian). Today an activity belongs to one group and applies only to that group's subtree (DESIGN.md §3.3), so each side has to create its own copy, attendance is split, and nobody sees the whole picture. Build after `member-summaries`.

## What Changes

- An activity keeps its **creator group** (`Activity.groupId`) and may gain **joint owners** (*pemilik bersama*) in other parts of the tree. No two groups among creator and joint owners may be ancestor/descendant of each other (a descendant is already covered by inheritance). Creator + accepted joint owners = the **owner groups**.
- **Invite → accept**: an admin of the creator group invites any group of the same organization (group names are visible to everyone in the organization for this picker) with a start date (default today, past or future allowed). Any ADMIN/OWNER of the invited group (main role there, or an additional ADMIN role on it) accepts or declines.
- **Pending**: the invited group's admins see the activity details (schedule, location, notes, creator, joint owners) but no members, no attendance, and cannot edit or tag.
- **Accepted**: from its start date, the activity is *owned* by the joint owner for its subtree — not inherited: visible, listed (badge *gabungan*, no *warisan*), conflict-checked, attendance recordable by users in that subtree for their scope.
- **Editing**: admins of any owner group edit the template, override/cancel/move occurrences, split, and end from a date. Only the creator group deletes (including an end that turns into a delete), invites, changes start dates, cancels invitations and removes joint owners. Joint owners cannot leave.
- **Tagging**: tags from any owner group's chain can be attached, by anyone allowed to use them (§13.2); visibility follows normal tag rules, so each branch sees its own tags.
- **Joint admins**: ADMIN/OWNER of any owner group see names and attendance of every owner group's subtree **on that activity's pages only**, and can mark attendance for any of them (including future dates, as ADMIN can today). Everyone else, including admins above an owner group, sees only their own scope. Member pages, member lists and statistics stay scope-limited for everyone. A removed joint owner's admins stay joint admins for dates up to the end date, but lose edit rights.
- **History is never hidden**: a later start date or an end date that would exclude already-recorded attendance of that joint owner is rejected.
- Audit: `activity.invite`, `activity.co_owner_update`, `activity.invite_cancel`, `activity.invite_accept`, `activity.invite_decline`, `activity.co_owner_remove`; joint-owner edits use the existing activity actions.
- Out of scope: notifications outside the app, joint surveys, transferring the creator role.

## Capabilities

### New Capabilities
- `joint-activities`: joint owners of an activity — invitation lifecycle, eligibility, what applies/is visible to them, editing split between owner groups and the creator group, tagging, joint-admin attendance rights, removal and history guard, group deletion, audit.

### Modified Capabilities
None in `openspec/specs/` (activity scheduling, attendance, tags and authorization specs still live in unarchived changes); the new capability states how their rules extend, and DESIGN.md §3.3/§5/§6/§13 are updated.

## Impact

- Prisma: new `ActivityCoOwner` model + migration.
- `lib/authz.ts`: owner-group-aware `canViewActivity` / `canEditActivity` / `canRecordAttendance`, new `isJointAdmin`, `canDeleteActivity` (creator only), new actions `activity.invite`, `activity.respond`, `activity.manageCoOwners`; `lib/resolve.ts` loads joint owners with the activity.
- `lib/tag/access.ts`: `canTagActivity` checks against every owner group.
- Activity logic: `lib/activity/*` list (§5.3), conflicts (§5.4), split/end/delete (§5.5); `lib/stats.ts` expected population; attendance actions (`setMemberAttendance`, `saveAttendance`, check-in).
- UI: "Pemilik bersama" section + invite dialog in activity settings, "Undangan kegiatan" list for invited admins (dashboard + activity list), attendance table group filter across owner groups, badge *gabungan*.
- Group emptiness check (§3.2): a group that is a pending/accepted joint owner is not empty.
- DESIGN.md §2, §3.2, §3.3, §4.5, §5, §6, §7, §13 updated in the same commit.
