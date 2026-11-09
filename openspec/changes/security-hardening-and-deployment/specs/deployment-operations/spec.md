## Purpose

Defines how the production deployment is hosted, how the client IP is trusted, and how the SQLite database (which holds member PII) is backed up, retained, monitored and restored.

## ADDED Requirements

### Requirement: Single-process hosting behind a TLS proxy
Production SHALL run exactly one application process on one server with a persistent disk. The process SHALL listen only on the loopback interface; all public traffic SHALL arrive through a reverse proxy that terminates TLS and redirects HTTP to HTTPS. Only SSH, HTTP and HTTPS SHALL be reachable from the internet, and SSH SHALL accept key authentication only, with root login disabled.

#### Scenario: Direct port access refused
- **WHEN** a client on the internet connects to the server's application port (3000)
- **THEN** the connection is refused

#### Scenario: Plain HTTP redirected
- **WHEN** a client requests `http://<domain>/login`
- **THEN** it receives a permanent redirect to `https://<domain>/login`

#### Scenario: Password SSH refused
- **WHEN** someone attempts SSH login with a password
- **THEN** the server refuses it

### Requirement: Trusted client IP
The client IP used for rate limiting and audit entries SHALL be the TCP peer address as seen by the reverse proxy. The proxy SHALL replace (not append to) any forwarding header sent by the client, and the application SHALL ignore client-supplied forwarding values.

#### Scenario: Spoofed header
- **WHEN** a client at 203.0.113.7 sends `X-Forwarded-For: 1.2.3.4`
- **THEN** the audit entry for that request records `203.0.113.7`

### Requirement: Daily encrypted offsite backup
Every day at 02:00 Asia/Jakarta the server SHALL take a consistent online copy of the database without stopping the application, verify it with an integrity check, compress and encrypt it with a public key whose private key is not stored on the server, and upload it to IDCloudHost Object Storage. The plaintext copy SHALL never leave the server. The upload credentials SHALL be scoped to the backup bucket only.

#### Scenario: Nightly run
- **WHEN** the 02:00 backup runs while users are recording attendance
- **THEN** an encrypted object `daily/dahan-<YYYY-MM-DD>.db.gz.age` appears in the bucket and the application keeps serving requests

#### Scenario: Corrupt snapshot not uploaded
- **WHEN** the integrity check of the fresh copy fails
- **THEN** nothing is uploaded and the run is reported as failed

#### Scenario: Server compromise cannot read backups
- **WHEN** an attacker obtains full access to the server and the bucket credentials
- **THEN** they cannot decrypt any uploaded backup

### Requirement: Backup retention
The bucket SHALL retain daily backups for 30 days and one backup per calendar month (the first successful backup of the month) for 12 months. The server SHALL keep the 7 most recent backups locally, readable only by the application user, for fast restore.

#### Scenario: Daily pruning
- **WHEN** a daily backup object is older than 30 days
- **THEN** the next run deletes it

#### Scenario: Monthly kept for a year
- **WHEN** the backup of 2026-11-01 is 200 days old
- **THEN** its `monthly/` copy still exists

### Requirement: Backup failure is noticed
A backup run that fails at any step (copy, integrity check, encryption, upload, pruning) SHALL exit non-zero and SHALL notify the operator. Absence of a successful backup for more than 26 hours SHALL also notify the operator.

#### Scenario: Upload fails
- **WHEN** the object storage is unreachable during the run
- **THEN** the run exits non-zero and the operator receives an alert the same day

#### Scenario: Timer silently stopped
- **WHEN** no successful backup has been reported for 26 hours
- **THEN** the operator receives an alert

### Requirement: Restore procedure and drill
A documented, scripted restore SHALL take an encrypted backup (from the bucket or local copy), decrypt it with the offline private key, verify integrity, and replace the production database while the application is stopped, keeping the replaced file. A restore drill onto a scratch server SHALL be performed at least once per quarter and its date recorded.

#### Scenario: Restore latest backup
- **WHEN** the operator restores the latest backup on production
- **THEN** the application starts on the restored data and the previous database file is kept alongside with a timestamp suffix

#### Scenario: Wrong key
- **WHEN** a restore is attempted with a private key that does not match
- **THEN** the restore aborts before touching the production database

### Requirement: Safe upgrade procedure
Every upgrade SHALL be preceded by a fresh backup and a VPS snapshot, and SHALL use a locked dependency install and non-interactive migrations. Production SHALL NOT be deployed while `pnpm audit --prod` reports a high or critical advisory without a recorded exception.

#### Scenario: Upgrade with failing migration
- **WHEN** a migration fails during an upgrade
- **THEN** the operator can roll back to the pre-upgrade backup or snapshot following the runbook

#### Scenario: Vulnerable dependency
- **WHEN** `pnpm audit --prod` reports a critical advisory in `next`
- **THEN** the deploy is stopped until the dependency is upgraded or an exception is recorded
