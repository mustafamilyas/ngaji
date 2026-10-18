# Spec Delta

## Purpose

Shows the aggregated answers of a survey and how many of the expected members have answered, for one group in the viewer's scope, with sub-group and demographic breakdowns.

## ADDED Requirements

### Requirement: Population of a survey view
Statistics for survey S (owned by X) SHALL be computed for one selected group G, single-select, which SHALL be resolved server-side and lie in the viewer's scope (otherwise 404). The default G SHALL be X when X is in the viewer's scope, else the viewer's own group. The **population** SHALL be non-deleted members whose group is in both subtree(G) and subtree(X). Soft-deleted members and responses of soft-deleted members SHALL never be shown or counted.

#### Scenario: Default group for an admin above the owner
- **WHEN** a daerah ADMIN opens the results of a survey owned by a desa in their scope
- **THEN** the selected group is that desa

#### Scenario: Default group for a user below the owner
- **WHEN** a kelompok USER opens the results of a desa-wide survey
- **THEN** the selected group is their kelompok and only their kelompok's members are counted

#### Scenario: Group outside scope
- **WHEN** `?grup=` names a group outside the viewer's scope
- **THEN** the system responds 404

### Requirement: Response rate and non-respondents
For the population, the results tab SHALL show expected = members with `status = AKTIF`, answered = expected members who have a response, and the percentage. It SHALL list the expected members without a response ("Belum mengisi"), searchable by name and paginated with `EMBEDDED_PAGE_SIZE`, each with a link to the entry page when the viewer may record for them. Responses of members who are no longer `AKTIF` SHALL count in per-question results but not in expected or answered.

#### Scenario: Left member excluded from rate
- **WHEN** member M answered and later changed status to KELUAR
- **THEN** M's answers still appear in per-question results, and M is in neither expected nor answered

#### Scenario: Non-respondent list
- **WHEN** 10 active members are in the population and 7 responded
- **THEN** the rate shows 7/10 (70%) and "Belum mengisi" lists the other 3

### Requirement: Per-question results
For every question (archived questions included, marked as archived) the results tab SHALL show, over responses in the population:
- answered count (responses with an answer to this question);
- `SINGLE_CHOICE` / `MULTI_CHOICE`: count and percentage per option (archived options included and marked), percentage relative to the question's answered count — so multi-choice percentages MAY sum above 100%;
- `NUMBER`: count, average, minimum, maximum;
- `SCALE`: count, average, and count per scale value from `scaleMin` to `scaleMax` (zero-count values shown);
- `SHORT_TEXT` / `LONG_TEXT`: the answers with member name, newest first, paginated with `EMBEDDED_PAGE_SIZE`.

#### Scenario: Multi-choice percentages
- **WHEN** 4 members answered a multi-choice question and 3 picked A and 2 picked B
- **THEN** A shows 3 (75%) and B shows 2 (50%)

#### Scenario: Scale distribution includes zeros
- **WHEN** nobody chose 2 on a 1–5 scale
- **THEN** value 2 is shown with count 0

#### Scenario: No answers yet
- **WHEN** a question has no answers in the population
- **THEN** it shows "Belum ada jawaban" instead of a chart

### Requirement: Breakdown per direct sub-group
When G is not a leaf group, the results tab SHALL offer a breakdown by each direct child of G that intersects subtree(X): response rate per child, and for choice and scale questions the per-option / per-value counts per child.

#### Scenario: Breakdown by kelompok
- **WHEN** results are viewed for a desa with three kelompok
- **THEN** each kelompok shows its own expected, answered and per-option counts

### Requirement: Demographic filters
The results tab SHALL offer filters on sex, age bracket (`AGE_BRACKETS`, age computed today from `birthDate`), work status and marital status. Active filters SHALL narrow the population for every figure on the page (response rate, non-respondents, per-question results, breakdown). Filter state SHALL be in the URL; empty filters are omitted.

#### Scenario: Filter by sex
- **WHEN** the filter `sex = P` is applied
- **THEN** expected, answered and every per-question count include only female members

#### Scenario: Invalid filter value
- **WHEN** `?jk=X` is not a valid sex value
- **THEN** the filter is ignored (treated as empty)

### Requirement: Results respect scope even for visible surveys
A user who can see a survey SHALL only see answers of members in their own scope; responses of members outside it SHALL never be included in any figure or list on the page.

#### Scenario: Inherited survey, sibling data hidden
- **WHEN** a kelompok K1 user views a desa-wide survey that kelompok K2 members also answered
- **THEN** no K2 answer contributes to any number or list they see
