# Spec Delta

## Purpose

Lets the maintainer add a new organization, with its level ladder, root group and first OWNER, to a running deployment from the command line.

## ADDED Requirements

### Requirement: Create an organization from the CLI
`pnpm org:create` SHALL create, in one transaction: an organization (name, timezone), its levels (depth 0..n-1 in the given order), one root group at depth 0, and one active OWNER user at that root group. It SHALL be configured by environment variables: organization name, root group name, level names (optional, default `pusat,daerah,desa,kelompok`), timezone (optional, one of `Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`, default `Asia/Jakarta`), owner username, owner name, owner password. It SHALL work on an empty database and on a database that already holds other organizations, and SHALL NOT change any existing organization. `pnpm bootstrap` SHALL remain available as an alias of `pnpm org:create`, so existing deploy instructions keep working.

#### Scenario: First organization on an empty database
- **WHEN** `pnpm org:create` runs with valid variables against an empty database
- **THEN** one organization, its levels, a root group and one OWNER exist, and the OWNER can sign in

#### Scenario: Additional organization
- **WHEN** `pnpm org:create` runs with valid variables against a database that already holds org A
- **THEN** org B is created with its own levels, root group and OWNER, and org A's rows are unchanged

#### Scenario: Default timezone
- **WHEN** the timezone variable is unset
- **THEN** the organization's timezone is `Asia/Jakarta`

### Requirement: First OWNER is safe by default
The created OWNER SHALL have `mustChangePassword = true`, so they are forced to set their own password at first sign-in. The password SHALL meet the app's password rules and SHALL never be printed or logged. Creation SHALL write audit entries (`organization.create`, `user.create`) with `actorId = null`, scoped to the new root group, with the password hash redacted.

#### Scenario: Forced password change
- **WHEN** the new OWNER signs in for the first time
- **THEN** they are redirected to `/dashboard/akun/password` before any other page

#### Scenario: Password not echoed
- **WHEN** `pnpm org:create` succeeds
- **THEN** its output contains the organization name and owner username but not the password

#### Scenario: Audit entries visible to the new owner
- **WHEN** the new OWNER opens the audit log
- **THEN** the `organization.create` and `user.create` entries for their organization are listed, without a password hash

### Requirement: Invalid input is rejected without side effects
The command SHALL refuse to run, create nothing and exit non-zero when a required variable is missing, the password fails the password rules, the username is invalid or already taken in any organization, the timezone is not one of the three allowed values, or the level list is empty.

#### Scenario: Username already taken
- **WHEN** the owner username already exists in another organization
- **THEN** the command exits with an error naming the problem, and no organization, level, group or user is created

#### Scenario: Unsupported timezone
- **WHEN** the timezone variable is `Europe/London`
- **THEN** the command exits with an error and nothing is created

#### Scenario: Weak password
- **WHEN** the owner password is shorter than the minimum length
- **THEN** the command exits with an error and nothing is created
