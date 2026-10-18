# Spec Delta

## ADDED Requirements

### Requirement: Survey actions are logged
The following survey mutations SHALL be audited in the same transaction, with `groupId` set as stated:
- `survey.create`, `survey.update`, `survey.delete` — entity `Survey`, `groupId` = owning group; `before`/`after` = survey with its questions and options (form edits are one `survey.update` per save).
- `survey_response.save` — entity `SurveyResponse`, `groupId` = the member's group; `before` = previous answers (null when new), `after` = new answers; `meta = { surveyId, memberId }`.
- `survey_response.delete` — entity `SurveyResponse`, `groupId` = the member's group; `before` = deleted answers; `meta = { surveyId, memberId }`.
Answers are member PII and SHALL be visible only through the OWNER-only audit viewer within scope.

#### Scenario: Response overwrite audited
- **WHEN** a response is re-saved
- **THEN** one `survey_response.save` entry exists with both the previous and the new answers

#### Scenario: Response delete audited
- **WHEN** a response is deleted
- **THEN** a `survey_response.delete` entry holds the deleted answers in `before`

#### Scenario: Audit failure rolls back response save
- **WHEN** the audit insert throws while saving a response
- **THEN** no response or answer row is changed
