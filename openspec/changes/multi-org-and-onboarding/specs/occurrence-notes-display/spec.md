# Spec Delta

## Purpose

Shows each occurrence's Keterangan (per-date notes such as "Pengajar: Ilyas, Materi: X") wherever the schedule is read on screen, not only on the printed page.

## ADDED Requirements

### Requirement: Keterangan shown in the activity list and calendar
For each occurrence, the activity list view and the calendar view of `/dashboard/kegiatan` SHALL show its effective notes: the occurrence's own notes if set, otherwise the activity's notes. Nothing SHALL be shown when both are empty. The text SHALL be rendered as plain text (no HTML), SHALL wrap or truncate without breaking the layout at 360px width, and SHALL be shown in full where truncated (e.g. on the occurrence detail or on tap).

#### Scenario: Per-date notes in the list
- **WHEN** the 2026-10-25 occurrence of "Pengajian Rutin" has notes "Pengajar: Ilyas, Materi: Adab"
- **THEN** that row in the list view shows "Pengajar: Ilyas, Materi: Adab", and other dates of the same activity do not

#### Scenario: Fallback to activity notes
- **WHEN** an occurrence has no notes and its activity has notes "Bawa Al-Qur'an"
- **THEN** the list and calendar show "Bawa Al-Qur'an" for that occurrence

#### Scenario: Calendar view
- **WHEN** a user opens the calendar view for a week containing that occurrence
- **THEN** the occurrence's entry shows its notes

#### Scenario: Markup is not interpreted
- **WHEN** an occurrence's notes are `<b>Materi</b>`
- **THEN** the list shows the literal text `<b>Materi</b>`

### Requirement: Visibility follows the list scope
Notes SHALL be visible to every user who can see the occurrence in the list (any role, same scope and inheritance rules as the list). Editing notes SHALL stay limited to users with role ≥ ADMIN whose group is the activity's owner group, through the existing occurrence change form.

#### Scenario: USER in a descendant group sees notes
- **WHEN** a USER in a kelompok under the owner daerah opens the list
- **THEN** the inherited occurrence shows its notes

#### Scenario: Descendant ADMIN cannot edit notes
- **WHEN** an ADMIN of a kelompok submits an occurrence change with new notes for an activity owned by their daerah
- **THEN** the change is refused, and the notes are unchanged

#### Scenario: Out-of-scope occurrence
- **WHEN** a user's scope does not include the activity's owner group or its descendants
- **THEN** the occurrence and its notes do not appear in their list
