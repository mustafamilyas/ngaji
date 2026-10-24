# Spec Delta

## Purpose

Lets a prospective organization register interest from the public site: the details are kept as a lead for the maintainer and handed off to the maintainer's WhatsApp.

## ADDED Requirements

### Requirement: Interest form at /daftar
The public page `/daftar` SHALL show a form in Bahasa Indonesia with: name (required), WhatsApp number (required), organization name (required), approximate member count (optional, whole number ≥ 1), message (optional) and a required consent checkbox ("Saya setuju data ini dipakai untuk menghubungi saya"). Validation SHALL run on the client and again on the server with the same rules. The WhatsApp number SHALL be normalized with the same rules as member WhatsApp links. The page SHALL work at 360px width.

#### Scenario: Valid submission
- **WHEN** a visitor fills name, a valid WhatsApp number, organization name, ticks consent and submits
- **THEN** one lead is stored and the visitor is taken to the WhatsApp handoff

#### Scenario: Consent missing
- **WHEN** the visitor submits without ticking consent
- **THEN** the form shows an error, and no lead is stored

#### Scenario: Invalid WhatsApp number
- **WHEN** the visitor enters `abc` as WhatsApp number
- **THEN** the form shows an error, and no lead is stored

#### Scenario: Server rejects tampered input
- **WHEN** a request bypasses the client and posts an empty organization name
- **THEN** the server rejects it with a generic error, and no lead is stored

### Requirement: Lead storage
Each accepted submission SHALL be stored with its fields, consent time, IP and user agent, and SHALL write a `lead.create` audit entry in the same transaction. The lead and its audit entry SHALL NOT belong to any organization and SHALL NOT appear in any organization's audit log or pages. Leads SHALL never be shown on a public page or to any signed-in user.

#### Scenario: Lead not visible in an organization's audit log
- **WHEN** a lead is submitted and a root OWNER of any organization opens the audit log
- **THEN** no `lead.create` entry is listed

#### Scenario: No web access to leads
- **WHEN** any user, signed in or not, requests any app route
- **THEN** no lead data is rendered

### Requirement: Abuse protection
Submissions SHALL be limited per IP: once an IP has `INTEREST_RATE_LIMIT_MAX_PER_IP` accepted submissions within `INTEREST_RATE_LIMIT_WINDOW_MINUTES`, further submissions from that IP SHALL be refused with a generic "coba lagi nanti" message and not stored. The form SHALL include a hidden honeypot field; a submission with the honeypot filled SHALL be silently dropped: not stored, not audited, and answered as if it succeeded.

#### Scenario: Rate limit reached
- **WHEN** an IP that has reached the limit submits another valid form
- **THEN** the visitor sees the generic message, and no lead is stored

#### Scenario: Honeypot filled
- **WHEN** a submission has the honeypot field filled
- **THEN** the response looks like success, and no lead or audit entry is stored

### Requirement: WhatsApp handoff
After a lead is stored, the visitor SHALL be sent to `https://wa.me/<DAHAN_WHATSAPP>` with a prefilled Bahasa Indonesia message containing the submitted name, organization name, member count and message. The page SHALL also show a success state with a link that opens the same chat, in case the redirect is blocked. If `DAHAN_WHATSAPP` is missing or invalid, the lead SHALL still be stored and the visitor SHALL see a success message without a WhatsApp link.

#### Scenario: Handoff with prefilled text
- **WHEN** a lead from "Budi" for "Majelis An-Nur" is stored and `DAHAN_WHATSAPP` is `0812-3456-7890`
- **THEN** the visitor is sent to `https://wa.me/6281234567890?text=…` whose decoded text contains "Budi" and "Majelis An-Nur"

#### Scenario: Number not configured
- **WHEN** a lead is stored and `DAHAN_WHATSAPP` is unset
- **THEN** the visitor sees a success message, no WhatsApp link is shown, and the lead exists

### Requirement: Leads CLI
`pnpm leads` SHALL print stored leads, newest first, as a table, or as CSV with `--csv`. It SHALL read the database only and SHALL NOT change any data.

#### Scenario: Listing leads
- **WHEN** two leads exist and the maintainer runs `pnpm leads`
- **THEN** both are printed with submission time, name, WhatsApp number, organization name, member count and message, newest first

#### Scenario: CSV export
- **WHEN** the maintainer runs `pnpm leads --csv`
- **THEN** the output is valid CSV with a header row, and a message containing a comma or a newline is quoted correctly
