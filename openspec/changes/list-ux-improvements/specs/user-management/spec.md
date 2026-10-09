# Spec Delta

## MODIFIED Requirements

### Requirement: User management page
`/pengguna` SHALL list users in scope, searchable by name or username, filterable by one or more groups in scope (each including descendants), paginated by `PAGE_SIZE`, and expose only the controls the caller is allowed to use; the Server Actions SHALL enforce the same rules independently of the UI.

#### Scenario: Hidden control still enforced
- **WHEN** an ADMIN crafts a request to reset an OWNER's password
- **THEN** the system responds 403 even though no button was shown

#### Scenario: Search by username
- **WHEN** a user searches "admin_"
- **THEN** users whose name or username contains it are listed
