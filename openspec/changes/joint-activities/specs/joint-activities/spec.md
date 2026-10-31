# Spec Delta

## Purpose

Lets one activity be owned jointly by groups in different branches of the tree through an invite-and-accept flow: joint owners edit and tag it together, the creator group controls membership and deletion, and member data stays protected.

## ADDED Requirements

### Requirement: Joint owner eligibility
An activity SHALL have one **creator group** (the group it was created in) and zero or more **joint owner** groups, each with a status `PENDING`, `ACCEPTED`, `DECLINED` or `CANCELLED` (pending invitation withdrawn by the creator group). The creator group and every `ACCEPTED` joint owner are the activity's **owner groups**. Among the creator group and every `PENDING` or `ACCEPTED` joint owner, no group SHALL be an ancestor or descendant of another, and a group SHALL appear at most once. Joint owners SHALL belong to the same organization and SHALL NOT be deleted. Group IDs from the client SHALL be resolved on the server.

#### Scenario: Sibling kelompok invited
- **WHEN** creator kelompok K1 (desa D1) invites kelompok K5 (desa D2)
- **THEN** the invitation is created as `PENDING`

#### Scenario: Descendant rejected
- **WHEN** an activity created by desa D1 invites kelompok K1 under D1
- **THEN** the request is rejected and nothing is written

#### Scenario: Ancestor of a joint owner rejected
- **WHEN** K5 is already a joint owner and the creator group invites D2 (K5's parent)
- **THEN** the request is rejected

#### Scenario: Other organization rejected
- **WHEN** the invited group ID belongs to another organization
- **THEN** the response is 404 and nothing is written

#### Scenario: Re-invite after decline
- **WHEN** K5 declined and the creator group invites K5 again
- **THEN** the invitation returns to `PENDING`

### Requirement: Membership is managed by the creator group
Only a user holding ADMIN+ on the creator group (main role in it, or an additional ADMIN role on it) SHALL invite groups, change a joint owner's start date, cancel a pending invitation, or remove an accepted joint owner. The invite picker SHALL list all non-deleted groups of the organization by name, marking ineligible ones. Every invitation SHALL carry a start date chosen by the creator group (default: today in the organization's time zone; past and future dates allowed), which it MAY change later for a pending or accepted joint owner.

#### Scenario: Joint owner admin cannot invite
- **WHEN** an ADMIN of accepted joint owner K5 tries to invite K9
- **THEN** the request is rejected (403)

#### Scenario: USER of creator group cannot invite
- **WHEN** a USER of the creator group tries to invite a group
- **THEN** the request is rejected (403)

#### Scenario: Cancel pending invitation
- **WHEN** the creator group's admin cancels K5's pending invitation
- **THEN** K5 no longer sees the invitation

#### Scenario: Invite with a past start date
- **WHEN** the creator group invites K5 with start date 2026-10-01 and K5 accepts on 2026-11-01
- **THEN** K5 members are expected for occurrences from 2026-10-01

#### Scenario: Joint owner admin cannot change start date
- **WHEN** an ADMIN of K5 tries to change K5's start date
- **THEN** the request is rejected (403)

### Requirement: Invited group accepts or declines
A pending invitation SHALL be accepted or declined only by a user holding ADMIN or OWNER on the invited group itself (main role in that group, or an additional ADMIN role on it). Admins of its ancestors or descendants SHALL NOT respond. Accepting SHALL keep the start date the creator group chose.

#### Scenario: Invited group admin accepts
- **WHEN** an ADMIN of K5 accepts an invitation with start date 2026-11-01
- **THEN** the status becomes `ACCEPTED` with start date 2026-11-01

#### Scenario: Additional ADMIN role accepts
- **WHEN** a user whose main role is in desa D2 and who holds an additional ADMIN role on K5 accepts
- **THEN** the status becomes `ACCEPTED`

#### Scenario: USER cannot accept
- **WHEN** a USER of K5 tries to accept
- **THEN** the request is rejected (403)

#### Scenario: Ancestor admin cannot accept
- **WHEN** the ADMIN of desa D2 (K5's parent) tries to accept K5's invitation
- **THEN** the request is rejected (403)

#### Scenario: Unrelated user gets 404
- **WHEN** a user who can neither see the activity nor respond sends an accept request
- **THEN** the response is 404

### Requirement: Pending invitation shows details only
While `PENDING`, the invited group's ADMIN/OWNER users SHALL see the activity's details (name, schedule, location, notes, creator group, joint owners) and an "Undangan kegiatan" entry with accept/decline. They SHALL NOT see member names, expected counts or attendance of any group, SHALL NOT edit or tag the activity, and the activity SHALL NOT apply to the invited subtree (not listed in its schedule, no attendance).

#### Scenario: Attendance hidden while pending
- **WHEN** an ADMIN of pending K5 opens the activity's attendance page
- **THEN** the response is 404

#### Scenario: Not in the schedule while pending
- **WHEN** a USER of K5 opens `/dashboard/kegiatan`
- **THEN** the pending activity is not listed

#### Scenario: No edit while pending
- **WHEN** an ADMIN of pending K5 submits a template change
- **THEN** the request is rejected (403)

### Requirement: Accepted joint ownership applies like ownership
From its start date until its end date (if removed), an accepted joint owner J SHALL be treated like the creator group for its subtree: the activity applies to J and every descendant, is visible as an owned activity to users whose group is J, in J's subtree or above J (within their scope), is listed and conflict-checked for those groups, and its expected members include J's subtree. Occurrences with an effective date before the start date or after the end date SHALL NOT apply to J's subtree.

#### Scenario: Listed for joint owner subtree
- **WHEN** K5 accepted with start date 2026-11-01 and a USER of K5 opens the schedule for November
- **THEN** the activity's occurrences from 2026-11-01 are listed with a *gabungan* badge and without the *warisan* badge

#### Scenario: Not applied before the start date
- **WHEN** an occurrence was on 2026-10-25 and K5's start date is 2026-11-01
- **THEN** K5 members are not expected on 2026-10-25

#### Scenario: Conflict across owners
- **WHEN** K5 has its own activity at the same time as an accepted joint activity on the same date
- **THEN** both show the *konflik* badge for K5

### Requirement: Editing rights of joint owners
A user holding ADMIN+ on any owner group (creator or accepted, not removed joint owner; main role or additional ADMIN role) SHALL be able to change the template, override, cancel or move occurrences, use "geser ini & seterusnya", and end the activity from a date. Deleting the activity, including an end that would delete it (end date on or before its start), SHALL be allowed only to ADMIN+ of the creator group. Admins of a removed joint owner SHALL NOT edit. Joint owners SHALL NOT leave on their own.

#### Scenario: Joint owner admin edits template
- **WHEN** an ADMIN of accepted K5 changes the start time
- **THEN** the change is saved, audited, and applies to every owner group

#### Scenario: Joint owner admin overrides an occurrence
- **WHEN** an ADMIN of accepted K5 cancels one date
- **THEN** the occurrence is cancelled for every owner group

#### Scenario: Joint owner admin ends the activity
- **WHEN** an ADMIN of accepted K5 ends the activity from a date after its start
- **THEN** the end date is saved and audited

#### Scenario: Joint owner admin cannot delete
- **WHEN** an ADMIN of accepted K5 deletes the activity, or ends it from a date on or before its start
- **THEN** the request is rejected (403) and nothing is written

#### Scenario: USER of a joint owner cannot edit
- **WHEN** a USER of K5 submits a template change
- **THEN** the request is rejected (403)

#### Scenario: Ancestor admin cannot edit
- **WHEN** the ADMIN of desa D2 (above K5) submits a template change
- **THEN** the request is rejected (403)

#### Scenario: Joint owner cannot leave
- **WHEN** an ADMIN of K5 sends a request to remove K5
- **THEN** the request is rejected (403)

#### Scenario: Split keeps ownership
- **WHEN** an ADMIN of K5 uses "geser ini & seterusnya"
- **THEN** the new activity has the same creator group and the same pending and accepted joint owners with the same start dates

### Requirement: Tagging by joint owners
A joint activity SHALL accept tags whose owner group is on the ancestor chain of, or in the subtree of, any owner group (creator or accepted joint owner), attached by a user allowed to use that tag (§13.2). Key exclusivity (§13.3) applies per (tag owner group, key) across all tags on the activity. Tag visibility SHALL follow the normal tag rule: a tag on the activity is shown only to viewers who can see its owner group, so each branch sees its own tags.

#### Scenario: Joint owner attaches own tag
- **WHEN** a USER of accepted K5 attaches K5's tag `fokus` to the joint activity
- **THEN** it is attached and audited

#### Scenario: Other branch does not see it
- **WHEN** a USER of creator K1 (another desa) views the activity
- **THEN** K5's `fokus` tag is not shown and does not match K1's tag filters

#### Scenario: Pending group cannot tag
- **WHEN** an ADMIN of pending K5 attaches a K5 tag
- **THEN** the request is rejected (403)

#### Scenario: Unrelated branch tag rejected
- **WHEN** a user attaches a tag owned by kelompok K9, which is neither related to K1 nor to K5
- **THEN** the request is rejected

### Requirement: Attendance rights
A user whose group is an owner group or below one SHALL record attendance for leaf groups in their own scope under that owner group, with today's existing rules (§3.3). ADMIN/OWNER of any owner group (main role in that group or an additional ADMIN role on it) — **joint admins** — SHALL see and mark attendance for expected members of every owner group's subtree on that activity's attendance pages, including future dates as ADMIN may today. Admins of a removed joint owner SHALL remain joint admins for occurrence dates up to and including its end date, and SHALL NOT be joint admins for later dates. Other users SHALL only see attendance within their own scope. Member detail pages, member lists and statistics SHALL remain scope-limited for everyone.

#### Scenario: Creator admin marks joint owner member
- **WHEN** an ADMIN of creator K1 marks a K5 member HADIR
- **THEN** it is saved and audited

#### Scenario: Joint owner admin marks creator member
- **WHEN** an ADMIN of accepted K5 marks a K1 member IZIN
- **THEN** it is saved and audited

#### Scenario: Joint owner USER limited to scope
- **WHEN** a USER of K5 tries to mark a K1 member
- **THEN** the request is rejected and nothing is written

#### Scenario: Ancestor admin is not a joint admin
- **WHEN** the ADMIN of desa D2 (above K5) opens the attendance page
- **THEN** only members in D2's scope are shown, and marking a K1 member is rejected

#### Scenario: Removed joint owner admin on history
- **WHEN** K5 was removed with end date 2026-11-30 and an ADMIN of K5 marks a K1 member for 2026-11-15
- **THEN** it is saved and audited

#### Scenario: Removed joint owner admin after end date
- **WHEN** K5 was removed with end date 2026-11-30 and an ADMIN of K5 opens the attendance page for 2026-12-07
- **THEN** the response is 404

#### Scenario: Member page still scoped
- **WHEN** a K5 joint admin opens the detail page of a K1 member seen on the attendance page
- **THEN** the response is 404

### Requirement: Attendance summaries by viewer
The activity's "Absensi" tab SHALL cover every owner group's subtree for joint admins, and only the viewer's scope intersected with the owner groups' subtrees for everyone else. Statistik pages SHALL count a joint activity only for members in the selected scope group.

#### Scenario: Joint admin sees all
- **WHEN** an ADMIN of K5 opens the Absensi tab
- **THEN** totals and per-member rows cover K1's and K5's subtrees

#### Scenario: Joint owner USER sees own scope
- **WHEN** a USER of K5 opens the Absensi tab
- **THEN** totals and rows cover only K5's subtree

### Requirement: Removal keeps history
The creator group MAY remove an accepted joint owner from a date. Afterwards the activity SHALL no longer apply to that subtree for later occurrences, while recorded attendance SHALL be kept and still counted for earlier ones. Tags attached by the removed group SHALL stay linked and follow normal visibility.

#### Scenario: Removal keeps attendance
- **WHEN** the creator group removes K5 from 2026-12-01 and K5 had attendance on 2026-11-15
- **THEN** the 2026-11-15 attendance stays visible and counted, and K5 is not expected from 2026-12-01

#### Scenario: Removed joint owner loses edit rights
- **WHEN** an ADMIN of removed K5 submits a template change
- **THEN** the request is rejected (403)

### Requirement: Joint ownership dates never hide recorded attendance
Changing a joint owner's start date to a later date, or removing it with an end date, SHALL be rejected when attendance is already recorded for members of that joint owner's subtree on an occurrence that the new window would exclude. The error SHALL name the earliest (for a start date) or latest (for an end date) recorded date. Moving the start date earlier SHALL always be allowed.

#### Scenario: Later start date rejected
- **WHEN** K5 has attendance on 2026-10-12 and the creator group moves K5's start date to 2026-10-20
- **THEN** the change is rejected with a message naming 2026-10-12

#### Scenario: Removal before recorded attendance rejected
- **WHEN** K5 has attendance on 2026-11-22 and the creator group removes K5 with end date 2026-11-15
- **THEN** the change is rejected with a message naming 2026-11-22

#### Scenario: Earlier start date allowed
- **WHEN** the creator group moves K5's start date from 2026-11-01 to 2026-10-01
- **THEN** the change is saved and audited

### Requirement: Joint ownership in group lifecycle and audit
A group that is a `PENDING` or `ACCEPTED` (not removed) joint owner of a non-deleted activity SHALL NOT be deletable (not empty). Invite, start-date change, cancel, accept, decline and remove SHALL each write one audit entry in the same transaction (`activity.invite`, `activity.co_owner_update`, `activity.invite_cancel`, `activity.invite_accept`, `activity.invite_decline`, `activity.co_owner_remove`). Edits by joint owners SHALL use the existing activity audit actions with the acting user recorded.

#### Scenario: Joint owner group not empty
- **WHEN** an OWNER tries to delete K5 while it is an accepted joint owner
- **THEN** the deletion is rejected

#### Scenario: Accept audited
- **WHEN** K5's admin accepts
- **THEN** one `activity.invite_accept` audit entry is written in the same transaction
