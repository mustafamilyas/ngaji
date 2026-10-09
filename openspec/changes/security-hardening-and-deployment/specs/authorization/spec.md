## MODIFIED Requirements

### Requirement: Self-protection rules
A user SHALL NOT deactivate themselves or change their own role. The system SHALL refuse any deactivation, demotion or move that would leave the organization's root group (depth 0) without an active OWNER, including an OWNER moving themselves. This check SHALL hold under concurrent requests: two requests that are each allowed alone but together would leave no active root OWNER SHALL NOT both succeed.

#### Scenario: Last root OWNER
- **WHEN** the only active root OWNER attempts to deactivate their own account
- **THEN** the system rejects the request

#### Scenario: Two root owners
- **WHEN** two active root OWNERs exist and one deactivates the other
- **THEN** the deactivation proceeds

#### Scenario: Last root OWNER moves self
- **WHEN** the only active root OWNER moves their own account to a daerah group
- **THEN** the system rejects the request and the user stays in the root group

#### Scenario: Root OWNER moves self while another remains
- **WHEN** two active root OWNERs exist and one moves themselves to a daerah group
- **THEN** the move proceeds

#### Scenario: Concurrent mutual deactivation
- **WHEN** the only two active root OWNERs submit "deactivate the other" at the same moment
- **THEN** exactly one deactivation succeeds and the other is rejected
