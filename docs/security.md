# Security and privacy

> v1 foundation is in progress. See [current status and migration handoff](v1-progress.md) and [workspace migration details](database.md#workspace-migration-014-hosted). Hosted database/isolation and core Auth browser checks pass; production acceptance is incomplete. The published release remains v0.9.1.

## Boundaries

- Supabase Auth is the production identity source. Server routes call `getUser`; the Next.js proxy refreshes sessions with the SSR client.
- The local demo is explicitly enabled and isolated by an HttpOnly random session cookie. It is not production authentication. It writes only under ignored `.data/demo/`; do not put sensitive real datasets there.
- RLS is enabled on every table. Shared writes require `admin_users` membership, which users cannot assign. Private CRM tables use workspace membership policies and composite workspace/contact foreign keys. Profiles and preferences remain personal.
- Token and send-attempt tables have no authenticated-user grants. Server service-role access is used for Gmail operations, nonsecret connection identity, authenticated account deletion and atomic request-limit buckets. Auth rate limiting may occur before authentication; the bucket subjects are HMAC digests.
- Mutating API requests check the exact configured origin and validate with Zod. No request-supplied SQL executes. OAuth callback is protected by separate expiring state and PKCE.
- Response headers prevent framing and MIME sniffing, restrict browser capabilities and apply a per-request nonce CSP. Script evaluation is allowed only in development. Styles allow inline declarations for existing UI components; scripts do not. HTTPS deployments receive HSTS. Production runtime/CAPTCHA acceptance remains required.

## Email

See [email-security.md](email-security.md). Email content is sent as text, not HTML, with protected MIME headers. Tokens are authenticated-encrypted. Each recipient gets a separate message. Do-not-contact and archive checks happen before reservation and immediately before delivery. Attempts are durably reserved, rate-limited and never automatically retried after uncertain outcomes.

Do not log raw provider responses, tokens, secrets, contact bodies or OAuth callback URLs. Structured safe event categories record database, OAuth and send failures. Deployment monitoring should alert on those categories. Sentry is not configured in the local build.

## Data controls

Account JSON and contact CSV export include private data without synthetic row caps. CSV strings beginning with spreadsheet formula characters are neutralised. Imported contacts are never automatically published. Archive is reversible data retention; account deletion is a separate explicit operation.

JSON export uses an explicit allowlist in `src/lib/export.ts`, including profile/artist preferences, contacts with canonical references, statuses/follow-ups, notes, lists/members, views, templates, interactions and sent-email metadata/body. Auth sessions, passwords and provider/connection objects are never serialized. Arbitrary text deliberately entered into a user's CRM remains their data. Regression tests inject credential fields into records and verify omission.

Account deletion requires a verified user and either current-password proof or a password/Google authentication event within five minutes, then attempts Google revocation, removes local Gmail credentials and deletes the Supabase Auth user. Sole-member workspaces and private artists are removed; shared workspace data survives if another owner exists. Last-owner deletion with other members is blocked. Public canonical records remain even if created by the deleted user. If Google revocation is unavailable, remove the MusicMail grant from Google account permissions. Backups and log retention are operator responsibilities and need a documented schedule.

Admin shared edits support correction, archive and verification; they do not grant read access to another user's notes. A future correction-request intake process may use those controls without giving users direct shared write permissions.

## Review before UK launch

Obtain a qualified review of the source and lawful basis for professional contact data, transparency notices, individual versus corporate contacts, user-uploaded personal addresses, direct marketing rules, objections/suppression, access/correction/deletion, retention, processor agreements and international transfers. Publicly listed contact information alone is not a blanket permission to send marketing.

The ICO explains that business outreach can involve both UK GDPR and PECR, with the applicable requirements depending on the recipient and activity. Start with its [business-to-business marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/) and [electronic marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/). This document records review needs; it does not certify compliance.

## Operational review

Rotate secrets deliberately; an encryption-key change without re-encryption makes existing tokens unreadable. Keep encrypted backups and key material separately. Run dependency audit and the database isolation suite on every release. Exercise account deletion and restore procedures against staging before loading real private data. Ensure no sensitive data enters screenshots, fixtures, Git or CI artifacts.

## Authentication and request hardening

See [authentication implementation and setup](authentication.md). Supabase alone stores/verifies passwords. Auth API input is bounded to 16KB; general JSON requests to 2MB using a bounded UTF-8 stream. Unexpected errors return generic messages. Server-rendered workspace/onboarding/security pages require a verified Auth user; API identity also uses `getUser`. Session cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. No browser Supabase client or token localStorage is used.

Application limits use a service-only atomic PostgreSQL RPC: login 10/10 minutes per normalized email; signup/reset/resend share 3/hour per email; auth overall 300/minute; search 120/minute per user; workspace reads 180/minute; mutations 120/minute; imports 5/minute; full exports 10/minute; password change and sensitive actions 5/10 minutes; Gmail initiation 5/10 minutes and callbacks 10/10 minutes. These are initial beta limits subject to traffic review, not replacements for Supabase's direct-API rate limits and CAPTCHA. Shared limits return 429 plus Retry-After; tests verify atomic caps and window reset.

Optional TOTP enrollment/challenge UI is not implemented. MFA must be completed and tested before advertising MFA support. Deployment access logs must omit/redact OAuth query strings. Next.js development incoming-request URL logging is disabled; branded-template recovery/verification tokens travel in email URL fragments and are submitted by POST. Default development templates use the Supabase verification endpoint and PKCE callback code. Recovery requires signature-verified recovery AMR plus an expiring, single-use server grant; SDK redirect state and browser query flags are not authorization.

## Current acceptance

See [v1 acceptance](v1-acceptance.md) for exact live results and remaining blockers. The production-only dependency audit is clean; five development findings share one currently unpatched braces advisory, assessed in [dependency-audit.md](dependency-audit.md). They do not justify a breaking framework downgrade. CAPTCHA credentials/enforcement and Gmail provider acceptance remain pending. Google identity sign-in, MFA, collaboration UI and calendars are future features rather than v1 blockers.
