# v1 production foundation: current progress

Updated 2026-10-12. **Not released.** Published version remains 0.9.1. The combined foundation/Calendar/appearance/admin candidate is deployed at https://musicmail.vercel.app. Current authoritative evidence: [production provider checkpoint](google-gmail-acceptance.md). The earlier foundation report is [v1 acceptance](v1-acceptance.md).

- 23 hosted migrations match; every public table has RLS and reviewed grants.
- 157 live member A/B isolation assertions pass in both directions; fixtures removed.
- 111 production Auth/CRM/Calendar/Gmail-start assertions and 1,202 administrator acceptance assertions pass, including reset/change, export and deletion cleanup.
- 155 unit tests, 15 Chromium journeys, typecheck/lint/build and PostgreSQL integration pass.
- Working Resend SMTP/branded confirmation/recovery and DMARC are operator-verified; DNS records independently resolve.
- Production dependency audit clean; five dev findings share one unpatched advisory, reviewed as non-blocking with a narrow CI exception.
- Repository/history/local/deployed browser secret scans pass.
- Gmail consent, encrypted token storage, automatic refresh, one controlled self-send and inbox delivery are verified. Disconnect/revocation is verified against production storage and Google token rejection; the disposable self-test contact is archived with private send evidence retained.
- **Blockers:** Turnstile activation, public Google audience/verification readiness, then final provider-dependent release checks.
- No v1 version bump, release commit, tag, push or GitHub release. Publication remains authorized only after actual blockers pass.

The dated record below explains earlier work; its older setup/pending instructions are superseded by the acceptance report and current Auth/deployment documentation.

---

# Historical v1 implementation record

Updated 2026-09-30. **Work in progress, not released or production-ready.** Version remains 0.9.1. No v1 commit, tag, push or release has been made.

## Implementation and verification

| Area                 | Current status                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations           | 001–018 installed in hosted project `thkrltiusxylpzqwfasx`, recorded in `supabase_migrations.schema_migrations`. No synthetic seed catalogue loaded.                                                                                                                                                                      |
| Workspace ownership  | Personal workspaces, server-managed owner/member memberships, existing-user backfill, private CRM workspace foreign keys and membership RLS. Creator/actor `user_id` remains nullable attribution. No team UI.                                                                                                            |
| RLS and privileges   | Every public application table has RLS. Anonymous/PUBLIC table grants removed. Unsafe authenticated TRUNCATE/REFERENCES/TRIGGER grants removed. Service functions/token tables restricted.                                                                                                                                |
| A/B isolation        | Local SQL tests and **106 live Auth/Data API assertions** pass in both directions across contacts/follow-ups, notes, lists/members, views, interactions, templates and sent metadata. Shared entity remains visible with separate private overlays. Fixtures removed. Manual two-browser acceptance still pending.        |
| Signup/login         | Name/email/password/confirmation UI and server validation; Supabase-only password authority. Verified-user page/API checks, generic credential errors, pending/resend screens and idempotent profile/workspace provisioning implemented. Default-template development support implemented; actual inbox delivery pending. |
| Password policy      | Hosted Auth rejected the five specified weak cases and a too-short case with `weak_password`; generated strong password accepted. UI/server checks match. Leaked-password protection/plan status unconfirmed.                                                                                                             |
| Verification         | Hosted email confirmation enabled. Live application token redemption passed; actual inbox delivery pending.                                                                                                                                                                                                               |
| Reset/change         | Recovery-purpose, single-use token redemption and current-password reauthentication passed live browser tests. Global refresh-session sign-out after change/reset. SMTP recovery mail delivery pending.                                                                                                                   |
| Google login         | Identity-only Supabase flow implemented and mocked scope/redirect tests pass. Hosted provider still disabled; consent/callback/account-linking acceptance pending.                                                                                                                                                        |
| Sessions             | HttpOnly/Lax cookies, Secure on HTTPS; server `getUser` checks; proxy claim refresh; protected pages/APIs; fixed redirect targets. Local demo rejected on hosted origins/Vercel.                                                                                                                                          |
| Rate limits/CAPTCHA  | Atomic PostgreSQL application limits installed and tested; graceful 429/Retry-After. Turnstile UI/token forwarding implemented; widget secret/site key, provider enforcement and real challenge tests pending. Provider Auth limits require dashboard review.                                                             |
| Service secrets      | Server-only clients/encryption boundary. Configured-secret scan found no matches in working files, compiled browser assets or 201 historical Git blobs. Local database/API credentials work.                                                                                                                              |
| Gmail                | Existing state/PKCE, AES-256-GCM server tokens, refresh/revoke, send caps and replay protection retained. Initiation/callback limits and validation added. Local encryption key generated privately. Google Gmail credentials and live consent/send/revocation remain pending.                                            |
| Deletion/export      | Recent-auth deletion passed live browser test. Workspace deletion preserves public entities and blocks last-owner removal when other members remain. Private export isolation and >1,000-row local export tests pass.                                                                                                     |
| Headers/errors/input | Nonce CSP, frame/MIME/browser capability protections; HSTS on production HTTPS. Bounded UTF-8 request reading and safe unexpected errors. Auth tests cover cross-origin requests, fixed redirects, weak/mismatched input and rate limits. Production/CAPTCHA runtime acceptance still needed.                             |
| MFA                  | Optional TOTP UI/challenges not implemented; MFA support is not advertised.                                                                                                                                                                                                                                               |

## Checks actually run

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: **63 tests passed**, including new Auth handler/security tests.
- `npm run build`: passed with dynamic nonce-rendered pages.
- `npm run test:e2e`: **6 Chromium tests passed** against the local demo development server after default-template changes.
- `npm run test:db`: all **18 migrations**, repeatable seed, existing regressions, workspace backfill/isolation/grants and rate-window tests passed. Uses real local PostgreSQL roles plus a minimal Auth shim.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- `node --env-file=.env.local scripts/test-hosted-isolation.mjs`: **106 assertions passed** after migration 018; fixtures cleaned up.
- `node --env-file=.env.local scripts/test-hosted-auth.mjs`: live Chromium passed protected routes, verification token redemption, login/logout, HttpOnly cookies, reset purpose/single use, password change, CSP and recent-auth deletion. Uses generated email tokens, **not real email delivery**. Also checks malformed session rejection and fixed invalid-callback redirects.
- Hosted catalog checks at migration 017: **17 migrations; 0 tables missing RLS; 0 unsafe table grants; 0 unpinned security-definer search paths**. These targeted checks are not a claim that the complete Dashboard Security Advisor is cleared.

Supabase API and database connection blockers are resolved. Do not reconfigure those credentials without an actual connection error. Keep the local demo enabled for normal use until Auth email configuration/acceptance is complete; opt-in live tests temporarily run the server in non-demo mode.

## Exact next manual step

Use default Supabase confirmation and reset emails for development. Site URL `http://localhost:3000` is saved. Ensure **Authentication → URL Configuration → Redirect URLs** includes `http://localhost:3000/auth/callback`, then Save. Start signup at `/signup` and open the confirmation email in the same browser. Then start `/forgot-password` and open the recovery link in that browser. Do not share passwords or email links in chat. Default service delivery is restricted and quota-limited; avoid repeated requests.

Migration 018 adds server-only, single-use recovery grants for the default-template PKCE callback. Signed recovery claims are required; browser flags do not authorize password changes. Actual email delivery and PKCE inbox acceptance remain pending. Custom SMTP and branded templates are deferred to production readiness, not required for this development check. Next external configuration is Google identity, described in [authentication.md](authentication.md).

## Remaining release blockers

- Production email delivery and templates/SMTP acceptance. Google identity sign-in is optional for v1; Gmail integration acceptance remains required.
- CAPTCHA activation and provider rate-limit review; production deployment/HTTPS/domain validation.
- Dedicated live Gmail consent, refresh, one controlled delivery/recipient/Sent-folder check and disconnect verification.
- Remaining manual two-browser isolation/adversarial review, complete hosted advisor review, selected-plan backup/restore and secret recovery checks.
- Leaked-password protection status/plan availability and production operational configuration.
- Final whole-tree review, security scan and checks after remaining changes. No version bump, v1 changelog heading, tag or publication until all release blockers clear.

2026-09-30 continuation: migration 018 installed and hosted recovery-grant SQL checks passed. Typecheck, lint, 63 unit tests, 18-migration local database suite, build, six Playwright tests, live Auth regression and 106 hosted isolation assertions passed; npm audit reports zero vulnerabilities. Actual inbox/PKCE flow is still pending user browser participation. The local server is temporarily running with `MUSICMAIL_DEMO=false` for this check; `.env.local` demo preference is unchanged. No real recipient address is stored in tracked fixtures.

Inbox follow-up: signup email confirmation is recorded in hosted Auth. The user reported opening the reset email on a phone after starting it on the Mac; this cannot complete the local same-browser PKCE flow. Subsequent requests reached the application email limit. No limits were bypassed and no additional emails sent. UI now explains same-browser/device use and reports remaining application-limit minutes; provider retry timing is no longer invented. Typecheck, lint, build and 64 unit tests pass. Actual successful inbox password recovery remains pending.

Release scope updated: [the current release checklist](release-checklist.md) follows the user’s final v1 scope. Google identity sign-in, MFA, band invitations, calendar and calendar sync are optional, not release gates. Google identity UI defaults off (`GOOGLE_AUTH_ENABLED=false`) independently of Gmail. Version bump, final commit, tag, push and GitHub release are authorized only after required production gates pass.

Production candidate deployed 2026-09-30 to https://musicmail.vercel.app (Vercel deployment `dpl_HtxC35wFXyHTLw9qaULdVwyVZ4RZ`, project `nicksuciu7/musicmail`). Version is still 0.9.1; deployment came from the local working tree, with no Git commit/tag/push/release. Vercel build passed and install audit reported zero vulnerabilities. Production demo and optional Google login are disabled; Supabase service key and encryption key are Vercel secrets. Database connection URI and local env files were not uploaded. Configured-secret working-source scan found zero matches, and no private env files are tracked.

Live HTTP checks: landing/login/signup 200; protected home redirects to login; workspace/export API return 401 anonymously. Login includes nonce CSP, HSTS, no-store, nosniff and frame denial. These smoke checks do not establish production signup or recovery acceptance.

Next manual step: Supabase → Authentication → URL Configuration: save Site URL `https://musicmail.vercel.app`; add exact redirect URLs `https://musicmail.vercel.app/auth/callback`, `https://musicmail.vercel.app/verify-email`, and `https://musicmail.vercel.app/reset-password`. Existing localhost entries may remain temporarily for development. SMTP/domain, CAPTCHA, Gmail and live release gates remain incomplete. Do not request production email links before the URL configuration is saved.

Production URL configuration verified after user save: Supabase admin-generated recovery links resolve to the default Site URL `https://musicmail.vercel.app` and accept all three exact `/auth/callback`, `/verify-email`, `/reset-password` redirects. A disposable confirmed fixture was created and deleted; no emails were sent. Invalid and tampered production callbacks redirect to the fixed HTTPS login page. Actual inbox delivery is still pending SMTP; these tests establish URL configuration only. Next manual blocker is Resend account and sender-domain setup.

2026-10-03 email setup: Resend dashboard independently confirms `auth.musicmailapp.uk` Verified, sending enabled, DKIM and sending records verified (Ireland). Public DNS lookup confirms DKIM and Resend sending CNAMEs. No DMARC TXT was returned at the sending subdomain or parent domain during this check. Supabase custom SMTP was still disabled. Its form is now prepared, **unsaved**, with sender `hello@auth.musicmailapp.uk`, name `MusicMail`, host `smtp.resend.com`, port 465, username `resend`, and existing 60-second per-user interval. User must enter the Resend API key directly in the dashboard Password field and Save changes; the key is not available locally and has not been read or copied into the repository. SMTP activation, branded templates, confirmation/recovery delivery and inbox authentication results remain unverified. No v1 publication.

2026-10-03 SMTP activation verified in Supabase dashboard: custom SMTP enabled; stored password masked; sender `MusicMail <hello@auth.musicmailapp.uk>`; `smtp.resend.com:465`; username `resend`; per-user email interval 60 seconds. SMTP key was entered by the operator and never read or saved in Git/chat. Branded confirmation and recovery templates were saved and their rendered previews checked. Links use `.SiteURL` plus `/verify-email#token_hash={{ .TokenHash }}` or `/reset-password#token_hash={{ .TokenHash }}`; subjects are “Verify your MusicMail email” and “Reset your MusicMail password”.

Provider limits reviewed without changes: 30 emails/hour, 30 signup/signin requests per 5 minutes per IP, 30 token verifications per 5 minutes per IP, 150 refreshes per 5 minutes per IP; IP forwarding off. These remain acceptance-scale defaults, with Resend capacity and real traffic still to be reviewed. Two actual delivery tests await recipient confirmation. Sending, delivery, inbox authentication and end-to-end production recovery have not yet been certified.

2026-10-03 confirmation bug resolved and deployed: accepted bounded `pkce_`-prefixed hashes without changing Supabase verification, purpose or single-use enforcement. 72 unit tests, typecheck/lint/build and production confirmation acceptance passed. One actual fresh SMTP signup email was opened and confirmed by the operator; Supabase verified state was independently checked and the disposable account cleaned up. See [investigation and evidence](confirmation-link-verification.md). Resend tracking details remain partially unverified after browser access was blocked; actual received links were direct MusicMail links. New dependency audit now reports five high development-tree findings, requiring review before release. No v1 publication.
