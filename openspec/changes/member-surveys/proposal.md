# Proposal

## Why

Groups collect information from members on paper or in chat (readiness for an event, opinions, needs) and have nowhere to store it next to the member data or see the totals. Admins need a place to define a custom form per group, enter each member's answers one by one, and see the statistics — without opening a public survey link.

## What Changes

- **Surveys owned by a group**, inherited by all its descendants exactly like activities (DESIGN.md §3.3): only ADMIN+ in the owning group builds or edits the form; users in the owning group or below enter responses; users above only view.
- **Custom form builder** with question types single choice (Yes/No preset), multiple choice, number, scale (default 1–5), short text and long text; per-question required flag, order and help text.
- **Lock once answered**: after the first response, question types can no longer change and answered questions/options are archived instead of removed; labels can still be edited and questions/options added.
- **Responses linked to members**: at most one response per member per survey, entered by an admin/user for a member of a leaf group in their scope; editing overwrites; responses can be deleted (hard delete, like attendance rows), always audited.
- **No lifecycle states**: a survey accepts responses until it is soft-deleted.
- **Survey statistics**: per-question results (counts/% for choices; avg/min/max/distribution for numbers and scales; paginated list for text), response rate against expected active members of a chosen scope group, a "belum mengisi" list, breakdown per direct sub-group, and demographic filters (sex, age bracket, work status, marital status).
- **Pages**: `/survei`, `/survei/baru`, `/survei/[id]` (tabs Hasil / Responden / Formulir), `/survei/[id]/isi`; new sidebar item "Survei".

## Capabilities

### New Capabilities
- `survey-forms`: survey ownership, inheritance, form builder, question types and the lock-once-answered rules.
- `survey-responses`: entering, editing and deleting a member's response; validation of answers against the form.
- `survey-statistics`: per-question results, response rate, non-respondent list, sub-group breakdown and demographic filters.

### Modified Capabilities
- `authorization`: permission matrix gains `survey.*` and `survey_response.*` actions.
- `audit-log`: logged actions gain `survey.create/update/delete` and `survey_response.save/delete`.

## Impact

- **Schema**: new models `Survey`, `SurveyQuestion`, `SurveyOption`, `SurveyResponse`, `SurveyAnswer`; new relations on `Group`, `Member`, `User`. One migration. Seed gains a sample survey with responses.
- **Code**: `lib/survey/*` (pure answer validation, lock rules, aggregation — tests first), `lib/validation/survey.ts`, new values in `lib/validation/enums.ts`, `lib/authz.ts` actions + cross-scope tests, `app/survei/*`, nav item in `lib/nav.ts`.
- **Security**: answers are PII tied to a member; every query is scope-filtered and every client ID (`surveyId`, `questionId`, `optionId`, `memberId`, `groupId`) is resolved server-side.
- **Docs**: DESIGN.md §2, §3.2, §3.5, §4.5, §7 and new §11 Survei.
- No changes to existing activity, attendance or member behaviour.
