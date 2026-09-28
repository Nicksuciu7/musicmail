# Security and privacy

## Boundaries

- Supabase Auth is the production identity source. Server routes call `getUser`; the Next.js proxy refreshes sessions with the SSR client.
- The local demo is explicitly enabled and isolated by an HttpOnly random session cookie. It is not production authentication. It writes only under ignored `.data/demo/`; do not put sensitive real datasets there.
- RLS is enabled on every table. Shared writes require `admin_users` membership, which users cannot assign. Private tables use owner policies and composite owner/contact foreign keys.
- Token and send-attempt tables have no authenticated-user grants. Server service-role access is restricted to Gmail operations, its nonsecret connection identity and account deletion, after user authentication.
- Mutating API requests check the exact configured origin and validate with Zod. No request-supplied SQL executes. OAuth callback is protected by separate expiring state and PKCE.
- Default response headers prevent framing and MIME sniffing. Production requires HTTPS. A strict CSP should be evaluated with the chosen production runtime and nonce setup before launch; it is not claimed implemented.

## Email

See [email-security.md](email-security.md). Email content is sent as text, not HTML, with protected MIME headers. Tokens are authenticated-encrypted. Each recipient gets a separate message. Do-not-contact and archive checks happen before reservation and immediately before delivery. Attempts are durably reserved, rate-limited and never automatically retried after uncertain outcomes.

Do not log raw provider responses, tokens, secrets, contact bodies or OAuth callback URLs. Structured safe event categories record database, OAuth and send failures. Deployment monitoring should alert on those categories. Sentry is not configured in the local build.

## Data controls

Account JSON and contact CSV export include private data without synthetic row caps. CSV strings beginning with spreadsheet formula characters are neutralised. Imported contacts are never automatically published. Archive is reversible data retention; account deletion is a separate explicit operation.

Account deletion attempts Google revocation, removes local Gmail credentials and deletes the Supabase Auth user. Foreign-key cascades remove private records and the user's private artist project. Public shared records not owned by that user remain. If Google revocation is unavailable, remove the MusicMail grant from Google account permissions. Backups and log retention are operator responsibilities and need a documented schedule.

Admin shared edits support correction, archive and verification; they do not grant read access to another user's notes. A future correction-request intake process may use those controls without giving users direct shared write permissions.

## Review before UK launch

Obtain a qualified review of the source and lawful basis for professional contact data, transparency notices, individual versus corporate contacts, user-uploaded personal addresses, direct marketing rules, objections/suppression, access/correction/deletion, retention, processor agreements and international transfers. Publicly listed contact information alone is not a blanket permission to send marketing.

The ICO explains that business outreach can involve both UK GDPR and PECR, with the applicable requirements depending on the recipient and activity. Start with its [business-to-business marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/) and [electronic marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/). This document records review needs; it does not certify compliance.

## Operational review

Rotate secrets deliberately; an encryption-key change without re-encryption makes existing tokens unreadable. Keep encrypted backups and key material separately. Run dependency audit and the database isolation suite on every release. Exercise account deletion and restore procedures against staging before loading real private data. Ensure no sensitive data enters screenshots, fixtures, Git or CI artifacts.
