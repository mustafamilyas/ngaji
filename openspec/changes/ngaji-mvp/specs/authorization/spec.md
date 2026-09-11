## ADDED Requirements

### Requirement: Scope
A user's scope SHALL be their group plus all descendants (`group.path startsWith user.groupPath`). Every list query SHALL be filtered by scope on the server. The system SHALL never trust a `groupId` or `groupPath` supplied by the client.

#### Scenario: List is scope-filtered
- **WHEN** an ADMIN at daerah D lists members
- **THEN** only members whose group path starts with D's path are returned

#### Scenario: Forged groupId ignored
- **WHEN** a request includes a `groupId` outside the caller's scope
- **THEN** the system resolves the group server-side and responds 404

### Requirement: Every client ID is resolved and checked
Every ID received from the client (`groupId`, `memberId`, `activityId`, `occurrenceId`, `userId`) SHALL be resolved to its entity server-side and passed to `authorize(session, action, target)`. Entities that are soft-deleted or outside scope SHALL produce a 404, not a 403.

#### Scenario: Out-of-scope member update
- **WHEN** a USER at kelompok K1 submits an update for a member belonging to sibling kelompok K2
- **THEN** the system responds 404 and writes nothing

#### Scenario: Soft-deleted entity
- **WHEN** a request references a member whose `deletedAt` is set
- **THEN** the system responds 404

### Requirement: Permission matrix
`authorize` SHALL implement exactly this matrix (✅ allowed, ❌ denied), always additionally requiring the target to be in scope:

| Action | OWNER | ADMIN | USER |
|---|:-:|:-:|:-:|
| View groups, members, activities, statistics in scope | ✅ | ✅ | ✅ |
| Create / update / soft-delete members in scope | ✅ | ✅ | ✅ |
| Record attendance (see `attendance` spec) | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| Create / rename / soft-delete sub-groups in scope | ✅ | ✅ | ❌ |
| Create / update / delete activities owned by the user's own group | ✅ | ✅ | ❌ |
| Cancel / override / move occurrences of activities owned by the user's own group | ✅ | ✅ | ❌ |
| Create USER / ADMIN accounts for groups in scope | ✅ | ✅ | ❌ |
| Reset another user's password | ✅ anyone in scope | ✅ only USER in same group | ❌ |
| Create OWNER accounts | ✅ | ❌ | ❌ |
| Change role, move user to another group, activate/deactivate user | ✅ | ❌ | ❌ |
| View audit log in scope | ✅ | ❌ | ❌ |
| Rename levels | ✅ only if own group depth = 0 | ❌ | ❌ |

#### Scenario: USER cannot create a sub-group
- **WHEN** a USER calls the create-group action for a parent in scope
- **THEN** the system responds 403

#### Scenario: ADMIN may create a sub-group
- **WHEN** an ADMIN calls the create-group action for a parent in scope
- **THEN** the action proceeds

#### Scenario: ADMIN cannot deactivate a user
- **WHEN** an ADMIN calls `user.setActive` for a USER in scope
- **THEN** the system responds 403

### Requirement: Activity edit rights belong to the owning group only
`activity.create` SHALL require `groupId === session.groupId`. `activity.update`, `activity.delete`, `activity.split` and `occurrence.override` SHALL require `activity.groupId === session.groupId` and role ≥ ADMIN. No role, including a root OWNER, SHALL edit an activity owned by a different group.

#### Scenario: Root OWNER cannot edit a kelompok's activity
- **WHEN** the root OWNER attempts to change the start time of an activity owned by kelompok K
- **THEN** the system responds 403

#### Scenario: Kelompok ADMIN edits own activity
- **WHEN** an ADMIN at kelompok K updates an activity whose `groupId` is K
- **THEN** the update proceeds

#### Scenario: Kelompok ADMIN cannot edit inherited activity
- **WHEN** an ADMIN at kelompok K attempts to cancel an occurrence of an activity owned by its daerah
- **THEN** the system responds 403

### Requirement: Self-protection rules
A user SHALL NOT deactivate themselves or change their own role. The system SHALL refuse to deactivate or demote the last active OWNER whose group has depth 0.

#### Scenario: Last root OWNER
- **WHEN** the only active root OWNER attempts to deactivate their own account
- **THEN** the system rejects the request

#### Scenario: Two root owners
- **WHEN** two active root OWNERs exist and one deactivates the other
- **THEN** the deactivation proceeds
