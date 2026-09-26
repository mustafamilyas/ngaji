# Spec Delta

## MODIFIED Requirements

### Requirement: Inheritance and visibility
An activity owned by group X SHALL apply to X and all its descendants. Activity A SHALL be visible to a user at group G when `A.groupId ∈ ancestors(G) ∪ scope(G)`; otherwise the system SHALL respond 404. The activity list for a set of one or more groups `{Y1, ..., Yn}` SHALL include activities with `groupId ∈ ⋃i (ancestors(Yi) ∪ {Yi} ∪ descendants(Yi))`, de-duplicated by occurrence (`activityId` + rule date), and mark each occurrence as `inherited`, `canEdit`, `canRecord` relative to the group(s) it applies to. Each `Yi` SHALL be resolved and scope-checked independently; a `Yi` outside the caller's scope SHALL be excluded from the union rather than causing the whole request to fail. The single-group case (`n = 1`) SHALL behave exactly as before, including defaulting to the caller's own group when no group is specified.

#### Scenario: Inherited activity shown read-only
- **WHEN** an ADMIN at kelompok K views an activity owned by its daerah
- **THEN** it is shown with an "warisan" badge and no edit controls

#### Scenario: Sibling-branch activity is 404
- **WHEN** a user at kelompok K1 opens `/kegiatan/[id]` for an activity owned by sibling kelompok K2
- **THEN** the system responds 404

#### Scenario: Union across two unrelated selected groups
- **WHEN** a user in scope of both selects kelompok K1 and kelompok K2 (different daerah, no ancestor/descendant relationship)
- **THEN** the list contains K1's own and inherited activities together with K2's own and inherited activities, with no cross-visibility between K1 and K2

#### Scenario: Shared ancestor activity appears once
- **WHEN** a user selects two kelompok that are both descendants of the same daerah, and that daerah owns an activity
- **THEN** the daerah's activity appears exactly once in the combined list, not twice
