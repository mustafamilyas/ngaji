## MODIFIED Requirements

### Requirement: Username and password login
The system SHALL authenticate users with username + password via Auth.js Credentials, comparing against a bcrypt hash with cost ≥ 12. Login failures SHALL return a single generic message regardless of cause. The username SHALL be normalized (surrounding whitespace removed) once, and that normalized value SHALL be used for the lookup, the rate-limit check and the audit entry. A failed login for an unknown or inactive username SHALL still perform one bcrypt comparison, so its response time is not distinguishable from a wrong password.

#### Scenario: Successful login
- **WHEN** an active user submits correct credentials
- **THEN** a session is created and an `auth.login` audit entry is written

#### Scenario: Wrong password
- **WHEN** a user submits an incorrect password
- **THEN** the response says "username atau password salah" and an `auth.login_failed` entry with `meta.username` is written

#### Scenario: Unknown username
- **WHEN** a login uses a username that does not exist
- **THEN** the response is the same generic message, a bcrypt comparison is still performed, and an `auth.login_failed` entry with `actorId = null` is written

#### Scenario: Inactive user
- **WHEN** a user with `isActive = false` submits correct credentials
- **THEN** login is refused with the generic message

#### Scenario: Whitespace-padded username is normalized
- **WHEN** a login is submitted with username `" budi "`
- **THEN** it is treated exactly as `budi` for lookup, rate limiting and the audit entry's `meta.username`

### Requirement: Login rate limiting
The system SHALL refuse a login attempt when, in the last 15 minutes, there are ≥ 5 `auth.login_failed` entries for the same normalized username or ≥ 20 for the same client IP. The client IP SHALL be the one established by the trusted reverse proxy (see `deployment-operations`), never a value the client can set. Concurrent attempts for the same username or IP SHALL be evaluated one after another, so that parallel requests cannot all pass the check before their failures are recorded. A refused attempt SHALL NOT compare the password.

#### Scenario: Sixth attempt blocked
- **WHEN** five failed attempts for `budi` occurred within 15 minutes and a sixth attempt uses the correct password
- **THEN** the attempt is refused without checking the password

#### Scenario: Window expires
- **WHEN** the oldest of five failures for `budi` is older than 15 minutes
- **THEN** a new attempt with the correct password succeeds

#### Scenario: Whitespace variant does not reset the counter
- **WHEN** five failed attempts for `budi` occurred within 15 minutes and a sixth attempt uses username `"budi "`
- **THEN** the attempt is refused

#### Scenario: Forged forwarding header is ignored
- **WHEN** 20 failed attempts came from one client within 15 minutes, each sending a different `X-Forwarded-For` value
- **THEN** the 21st attempt from that client is refused, and the audit entries record the client's real address

#### Scenario: Parallel burst
- **WHEN** 20 attempts with wrong passwords for `budi` are sent at the same moment with no prior failures
- **THEN** at most 5 of them have their password compared; the rest are refused as rate limited

### Requirement: Session claims are revalidated per request
The JWT SHALL carry `{userId, groupId, role, groupPath, sessionVersion}`. On every session read the system SHALL re-read the user's `isActive`, `role`, `groupId` and `sessionVersion` from the database; an inactive user's session SHALL be terminated, a session whose `sessionVersion` differs from the stored one SHALL be terminated, and changed claims SHALL replace the token's claims. `sessionVersion` SHALL increase whenever the user's password is changed by themselves or reset by someone else. No client-initiated session update SHALL be able to adopt a new `sessionVersion`.

#### Scenario: Deactivated mid-session
- **WHEN** an OWNER sets `isActive = false` on a user who has a valid session
- **THEN** that user's next request is redirected to `/login`

#### Scenario: Demoted mid-session
- **WHEN** an OWNER changes a user's role from ADMIN to USER while they are logged in
- **THEN** the user's next request evaluates authorization as USER without re-login

#### Scenario: Password reset ends existing sessions
- **WHEN** an OWNER resets the password of a user who is logged in on two devices
- **THEN** the next request from either device is redirected to `/login`

#### Scenario: Stolen session cannot refresh itself
- **WHEN** a session issued before a password change calls the session update endpoint
- **THEN** the session is still terminated on its next read

### Requirement: Forced password change
Users with `mustChangePassword = true` SHALL be redirected to `/akun/password` from every route except `/login` and `/akun/password` until they set a new password. Every Server Action other than changing one's own password and signing out SHALL refuse to run for such a user, regardless of the URL the action was posted to. The seeded owner, the bootstrapped owner and any user whose password was reset by someone else SHALL have this flag set.

#### Scenario: Seeded owner first login
- **WHEN** `admin` logs in for the first time after seeding
- **THEN** every navigation lands on `/akun/password` until a new password is saved

#### Scenario: Flag cleared after change
- **WHEN** the user saves a new password of at least 8 characters
- **THEN** `mustChangePassword` becomes false, `user.change_password` is audited, and the user is asked to log in again with the new password

#### Scenario: Action posted to the password page is refused
- **WHEN** a user with `mustChangePassword = true` invokes the create-member action by posting it to `/akun/password`
- **THEN** no member is created and no `member.create` audit entry is written

### Requirement: Own password change
Any authenticated user SHALL be able to change their own password by supplying the current password and a new password of at least 8 characters. A successful change SHALL end all of that user's sessions, including the current one, and send the user to `/login`. Failed current-password checks SHALL be rate limited with the same limits as login.

#### Scenario: Wrong current password
- **WHEN** the current password supplied does not match
- **THEN** the change is rejected and the stored hash is unchanged

#### Scenario: Other devices logged out
- **WHEN** a user logged in on a phone and a laptop changes their password on the laptop
- **THEN** both the phone and the laptop must log in again

#### Scenario: Guessing the current password is limited
- **WHEN** a session submits 5 wrong current passwords within 15 minutes
- **THEN** a sixth attempt is refused without comparing the password

### Requirement: Security headers
Every response SHALL include a `Content-Security-Policy` with `default-src 'self'`, a per-request script nonce, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'` and `form-action 'self'`, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. In production every response SHALL also include `Strict-Transport-Security: max-age=31536000; includeSubDomains`; in development it SHALL NOT be sent.

#### Scenario: Headers present in production
- **WHEN** any page is requested from a production build
- **THEN** the response contains all the headers above, including HSTS

#### Scenario: No HSTS on localhost development
- **WHEN** a page is requested from `pnpm dev`
- **THEN** the response has the CSP and other headers but no `Strict-Transport-Security`

#### Scenario: Injected base tag is inert
- **WHEN** a page somehow contains `<base href="https://evil.example/">`
- **THEN** the browser refuses it under `base-uri 'none'`
