## ADDED Requirements

### Requirement: Username and password login
The system SHALL authenticate users with username + password via Auth.js Credentials, comparing against a bcrypt hash with cost ≥ 12. Login failures SHALL return a single generic message regardless of cause.

#### Scenario: Successful login
- **WHEN** an active user submits correct credentials
- **THEN** a session is created and an `auth.login` audit entry is written

#### Scenario: Wrong password
- **WHEN** a user submits an incorrect password
- **THEN** the response says "username atau password salah" and an `auth.login_failed` entry with `meta.username` is written

#### Scenario: Unknown username
- **WHEN** a login uses a username that does not exist
- **THEN** the response is the same generic message and an `auth.login_failed` entry with `actorId = null` is written

#### Scenario: Inactive user
- **WHEN** a user with `isActive = false` submits correct credentials
- **THEN** login is refused with the generic message

### Requirement: Login rate limiting
The system SHALL refuse a login attempt when, in the last 15 minutes, there are ≥ 5 `auth.login_failed` entries for the same username or ≥ 20 for the same IP.

#### Scenario: Sixth attempt blocked
- **WHEN** five failed attempts for `budi` occurred within 15 minutes and a sixth attempt uses the correct password
- **THEN** the attempt is refused without checking the password

#### Scenario: Window expires
- **WHEN** the oldest of five failures for `budi` is older than 15 minutes
- **THEN** a new attempt with the correct password succeeds

### Requirement: Session claims are revalidated per request
The JWT SHALL carry `{userId, groupId, role, groupPath}`. On every session read the system SHALL re-read the user's `isActive`, `role` and `groupId` from the database; an inactive user's session SHALL be terminated and changed claims SHALL replace the token's claims.

#### Scenario: Deactivated mid-session
- **WHEN** an OWNER sets `isActive = false` on a user who has a valid session
- **THEN** that user's next request is redirected to `/login`

#### Scenario: Demoted mid-session
- **WHEN** an OWNER changes a user's role from ADMIN to USER while they are logged in
- **THEN** the user's next request evaluates authorization as USER without re-login

### Requirement: Session cookie hardening
Session cookies SHALL be `httpOnly`, `sameSite=lax`, `secure` in production, with a maximum age of 7 days.

#### Scenario: Cookie flags in production
- **WHEN** a session cookie is issued with `NODE_ENV=production`
- **THEN** it carries `HttpOnly`, `Secure` and `SameSite=Lax`

### Requirement: Forced password change
Users with `mustChangePassword = true` SHALL be redirected to `/akun/password` from every route except `/login` and `/akun/password` until they set a new password. The seeded owner and any user whose password was reset by someone else SHALL have this flag set.

#### Scenario: Seeded owner first login
- **WHEN** `admin` logs in for the first time after seeding
- **THEN** every navigation lands on `/akun/password` until a new password is saved

#### Scenario: Flag cleared after change
- **WHEN** the user saves a new password of at least 8 characters
- **THEN** `mustChangePassword` becomes false, `user.change_password` is audited, and `/` is reachable

### Requirement: Own password change
Any authenticated user SHALL be able to change their own password by supplying the current password and a new password of at least 8 characters.

#### Scenario: Wrong current password
- **WHEN** the current password supplied does not match
- **THEN** the change is rejected and the stored hash is unchanged

### Requirement: Security headers
Every response SHALL include `Strict-Transport-Security`, a `Content-Security-Policy` with `default-src 'self'` and `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

#### Scenario: Headers present
- **WHEN** any page is requested
- **THEN** the response contains all four headers
