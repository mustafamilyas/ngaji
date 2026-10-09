# Spec Delta

## ADDED Requirements

### Requirement: Survey permissions
`authorize` SHALL support the actions `survey.view`, `survey.create`, `survey.update`, `survey.delete`, `survey_response.record` and `survey_response.delete`, with these rules (see `survey-forms` and `survey-responses` for detail):

| Action | OWNER | ADMIN | USER | Condition |
|---|:-:|:-:|:-:|---|
| `survey.view` (incl. statistics) | ✅ | ✅ | ✅ | survey group is an ancestor of / equal to the user's group, or in scope; data limited to scope |
| `survey.create` | ✅ | ✅ | ❌ | survey group = user's group |
| `survey.update`, `survey.delete` | ✅ | ✅ | ❌ | survey group = user's group exactly |
| `survey_response.record`, `survey_response.delete` | ✅ | ✅ | ✅ | survey group is ancestor of / equal to user's group; member in a leaf group in scope; record requires member `AKTIF` |

A survey outside visibility, or a member outside scope, SHALL yield 404; a visible target the user may not act on SHALL yield 403.

#### Scenario: USER create denied
- **WHEN** `authorize(userSession, 'survey.create', ownGroup)` is called for a USER
- **THEN** it throws ForbiddenError

#### Scenario: Owner-group-only update
- **WHEN** `authorize(adminOfDesa, 'survey.update', surveyOwnedByKelompokUnderDesa)` is called
- **THEN** it throws ForbiddenError

#### Scenario: Out-of-branch survey
- **WHEN** `authorize(session, 'survey.view', surveyOfOtherBranch)` is called
- **THEN** it throws NotFoundError

#### Scenario: Record from above denied
- **WHEN** `authorize(adminOfDaerah, 'survey_response.record', { survey: ownedByDesa, member })` is called
- **THEN** it throws ForbiddenError

#### Scenario: Record for member out of scope
- **WHEN** `authorize(kelompokUser, 'survey_response.record', { survey: inherited, member: ofSiblingKelompok })` is called
- **THEN** it throws NotFoundError
