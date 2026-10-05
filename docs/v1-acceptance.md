# MusicMail production foundation acceptance — 2026-10-03

**Candidate deployed; v1 not published.** Version remains 0.9.1. Authoritative current results; older progress entries are historical. Production: https://musicmail.vercel.app. GitHub: https://github.com/Nicksuciu7/musicmail. Baseline commit: `1a2bb0cd9be922937aca8ae82fc2b91fcf0b8a6f`. Candidate deployment: `dpl_4bZjTXNTiEGjnxZw6z26i2mr4hJk`, built from the working tree, not a v1 release commit.

## Completed

- Hosted migrations 001–018 installed and reviewed, including ownership/backfill, explicit privileges, atomic shared rate limits and single-use recovery grants. Read-only migration ledger matches repository versions.
- Workspace membership RLS and composite parent/child foreign keys. Personal profile/preferences and Gmail identity stay user-bound; collaboration UI is not advertised.
- Supabase signup, mandatory verified email, login/logout, strong 10-character upper/lower/number/symbol password policy, explicit confirmation, secure recovery/change and recent-auth deletion.
- Admin-generated signup/recovery proofs verify production redemption, replay rejection, old-password rejection and fixed callback redirects without sending more emails. Actual SMTP inbox delivery and confirmation/reset completion are separately operator-verified; confirmation state was independently checked.
- Resend custom SMTP active, sender `MusicMail <hello@auth.musicmailapp.uk>`, verified sender domain and saved branded templates. SMTP secrets remain private in Supabase.
- JSON export explicitly selects business fields: complete contacts/canonical references, statuses/follow-ups, notes, lists/members, views, templates, interactions, sent-email records and profile/artist preferences. No page-size truncation or serialized Auth/provider objects. CSV export neutralizes spreadsheet formulas. Automated credential-field omission and >1,000-record coverage pass.
- Production smoke creates/edits private contacts, notes, lists/members and views; imports CSV, exports JSON/CSV, rejects rendered-note XSS, foreign origins and non-admin writes, exercises reset/change, then verifies Auth and private-data deletion.
- All public tables have RLS. No anonymous/private grants, untrusted public-schema CREATE, unsafe authenticated TRUNCATE/TRIGGER/REFERENCES, client access to server-only tables, or exposed privileged RPCs. Reviewed security-definer functions have pinned search paths.
- HttpOnly/Secure/Lax cookies, verified API identity, bounded UTF-8/Zod inputs, fixed production redirects, nonce CSP, HSTS, frame/MIME/capability headers and safe structured logs. No arbitrary SQL or raw user HTML is executed. Gmail uses fixed Google endpoints rather than user-supplied network URLs.
- Gmail code tests cover identity-only consent rejection, verified sender identity, server-side encrypted token refresh, revocation/local removal, cross-workspace contact rejection, suppression, send replay, durable metadata and uncertain outcomes without retry. **Live Google consent/send is not claimed.**
- README, changelog, Auth/security/architecture/database/deployment/email docs and anonymous production Auth screenshots updated.

## Test results

| Check                                   | Result                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                     | Pass                                                                                                                            |
| `npm run lint`                          | Pass                                                                                                                            |
| `npm test`                              | 98 tests, 7 files pass                                                                                                          |
| `npm run build`                         | Pass locally and on Vercel                                                                                                      |
| `npm run test:e2e`                      | 6 Chromium tests pass, including accessibility/mobile/isolated sessions                                                         |
| `npm run test:db`                       | All migrations, repeatable seed, backfill, RLS, privileges, deletion and recovery-grant SQL suites pass in temporary PostgreSQL |
| Hosted A/B Auth/Data API                | 106 assertions pass both directions; fixture users, workspaces and canonical entity removed                                     |
| Production Auth/CRM browser smoke       | 68 assertions pass; Auth and private-data fixture cleanup verified                                                              |
| Production explicit-confirmation smoke  | Pass: GET/HEAD/open do not consume; click verifies; replay rejected; secure cookies; prefixed token reaches Auth                |
| Hosted read-only database checks        | 8 checks pass; 18 migration versions match                                                                                      |
| `npm audit --omit=dev`                  | Zero vulnerabilities                                                                                                            |
| `npm audit`                             | Five high development findings, one reviewed braces advisory; intentionally remains nonzero                                     |
| `npm run check:dependencies`            | Pass under exact reviewed dev-only exception; rejects new/changed or production findings                                        |
| Repository/history/browser secret scans | Pass, including 243 Git blobs and 10 deployed browser assets; known private values and provider-secret patterns absent          |
| Hosted CAPTCHA activation               | **Blocked:** invalid token returns `invalid_credentials`, not `captcha_failed`; Supabase enforcement is not active              |

The repository PostgreSQL harness is the available equivalent of `supabase test db`; hosted migration/grant and Data API tests supplement it. No test was removed or weakened. The narrowly scoped dependency exception is documented in [dependency-audit.md](dependency-audit.md); both raw audits remain visible in CI artifacts.

## Email authentication and limits

Public DNS resolves a DKIM public key at `resend._domainkey.auth.musicmailapp.uk`, SPF at `send.auth.musicmailapp.uk`, and parent DMARC `v=DMARC1; p=none;` at `_dmarc.musicmailapp.uk`. No child DMARC override exists, so the parent policy applies. Resend previously verified the sending records/domain. These checks establish valid published DNS/provider configuration; they do not assert `spf=pass`, `dkim=pass` or `dmarc=pass` for every individual delivered message. Received-message header inspection remains operational hardening, not a reason to rebuild working SMTP.

Hosted settings were inspected on 2026-10-03: 30 Auth emails/hour per project; 60-second signup/recovery/resend interval; signup/signin 30/5 minutes per IP; verification 30/5 minutes per IP; token grants/refresh 150/5 minutes per IP; IP forwarding off. Retained as sensible controlled-acceptance limits. Application login is 10/10 minutes per email; signup/reset/resend share 3/hour; additional authenticated limits are in [security.md](security.md). Growth/SMTP capacity and shared server-IP contention need monitoring. Provider 429s are not bypassed.

## Outstanding classification

| Item                                                          | Classification          | Exact next action / acceptance                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turnstile                                                     | **BLOCKER**             | Create Managed widget for musicmail.vercel.app and localhost; public site key → Vercel Production `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secret → Supabase Authentication CAPTCHA, provider Turnstile, enable/save. Redeploy; run negative enforcement and real-widget Auth acceptance.                                      |
| Gmail production                                              | **BLOCKER**             | Operator clarified Google Cloud is not set up. Create/enable Gmail OAuth client and save server credentials in Vercel; exact callback `https://musicmail.vercel.app/api/gmail/callback`. Then one consenting Google account and controlled live send/refresh/disconnect acceptance. See [setup](google-gmail-setup.md). |
| Final release after provider activation                       | **BLOCKER / dependent** | Rerun changed-provider acceptance, final scans/checks, then version/commit/tag/push/release. Current acceptance does not certify future environment changes.                                                                                                                                                            |
| Unpatched development braces chain                            | NON-BLOCKING HARDENING  | Exact dev-only exception; monitor compatible upstream patch. Production audit clean.                                                                                                                                                                                                                                    |
| DMARC enforcement / per-message headers                       | NON-BLOCKING HARDENING  | Existing monitor policy valid; inspect delivery telemetry before a stronger policy. No DNS change requested now.                                                                                                                                                                                                        |
| Backups/restore, alerts, quota tuning                         | NON-BLOCKING HARDENING  | Rehearse staging restores; monitor safe log categories and capacity. Hosted dashboard advisors are not independently re-certified by SQL checks.                                                                                                                                                                        |
| Google identity login, MFA, band collaboration, calendar/sync | FUTURE FEATURE          | Optional; not v1 release gates.                                                                                                                                                                                                                                                                                         |

Google `gmail.send` is a sensitive scope. Testing audience limits access to nominated test accounts and has provider token restrictions; Google verification/public-audience requirements must be satisfied before unrestricted public Gmail rollout. Scope stays send-only; no inbox permission is added for testing convenience. [Google scope requirements](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Release decision

No 1.0.0 version bump, release commit, v1 tag, main/tag push or GitHub v1 release. Existing v0.9.0/v0.9.1 are preserved. Once genuine blockers pass, publication is already authorized: update version/lockfile/changelog, final secret scan/review, commit, annotated v1.0.0, push main/tag and create **MusicMail v1.0.0 — Production Foundation**. No force-push or history rewrite.
