## MODIFIED Requirements

### Requirement: Reset password policy
OWNER SHALL reset the password of any user whose group is in scope, except another OWNER whose group is the OWNER's own group or an ancestor of it: an OWNER SHALL reset another OWNER only when that OWNER's group is strictly below the caller's group. ADMIN SHALL reset only users with role USER whose `groupId` equals the ADMIN's own `groupId`. A reset SHALL set a server-generated temporary password, set `mustChangePassword = true`, end all of the target's sessions, and audit `user.reset_password` without the password.

#### Scenario: ADMIN resets USER in same group
- **WHEN** an ADMIN at kelompok K resets a USER at K
- **THEN** the reset proceeds

#### Scenario: ADMIN cannot reset peer ADMIN
- **WHEN** an ADMIN at K resets another ADMIN at K
- **THEN** the system responds 403

#### Scenario: ADMIN cannot reset USER in child group
- **WHEN** an ADMIN at daerah D resets a USER at kelompok K under D
- **THEN** the system responds 403

#### Scenario: OWNER resets in child group
- **WHEN** an OWNER at D resets an ADMIN at K under D
- **THEN** the reset proceeds

#### Scenario: OWNER resets OWNER strictly below
- **WHEN** an OWNER at pusat P resets an OWNER at daerah D under P
- **THEN** the reset proceeds

#### Scenario: OWNER cannot reset peer OWNER
- **WHEN** an OWNER at P resets another OWNER at P
- **THEN** the system responds 403 and no temporary password is generated

#### Scenario: OWNER resets ADMIN in own group
- **WHEN** an OWNER at P resets an ADMIN at P
- **THEN** the reset proceeds

## ADDED Requirements

### Requirement: Credential data never leaves the server
No Server Action response, page payload or client component prop SHALL contain a password hash or any field whose name starts with `password`, for any user. Actions that create or change a user SHALL return only the fields the UI displays (id, username, name, role, group, active flag) plus, where specified, the one-time temporary password.

#### Scenario: Create user response
- **WHEN** an OWNER creates a user
- **THEN** the action result contains the new user's id, username, name, role and group plus the temporary password, and no `passwordHash`

#### Scenario: Deactivate user response
- **WHEN** an OWNER deactivates a user
- **THEN** the action result contains no `passwordHash` of that user

### Requirement: Emergency owner recovery
When no OWNER above a locked-out OWNER can reset their password (for example the only root OWNER forgot it), an operator with shell access to the server SHALL be able to reset that OWNER's password, or reactivate them, through a server-side command. The command SHALL NOT be reachable over HTTP, SHALL generate the temporary password itself, SHALL set `mustChangePassword = true`, SHALL end the user's sessions, and SHALL write a `user.reset_password` audit entry with `actorId = null` and `meta.via = "cli"`.

#### Scenario: Root owner forgot password
- **WHEN** the operator runs the recovery command for username `owner` on the server
- **THEN** a temporary password is printed once, `owner` must change it at next login, and the audit log shows a CLI reset

#### Scenario: Unknown username
- **WHEN** the operator runs the recovery command for a username that does not exist
- **THEN** the command exits non-zero and changes nothing

#### Scenario: Not exposed on the web
- **WHEN** any HTTP request is made to the application
- **THEN** there is no route or action that performs the CLI recovery
