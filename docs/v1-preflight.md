# v1.0.0 production foundation: preflight

Audit date: 2026-09-29. Baseline: v0.9.1, commit `1a2bb0cd9be922937aca8ae82fc2b91fcf0b8a6f`.

**Historical initial preflight; see [current v1 progress](v1-progress.md).** Supabase API credentials have since been validated and local workspace migration work has begun. The following records the initial audit, not the current configuration.

**Initial status: blocked at hosted project setup. This is an implementation plan, not a production certification.** The requested section 47 stop applies: no hosted Supabase project is linked, and Supabase/Google/encryption credentials are empty in the local environment. No application code, migrations, package version, release tag, or hosted settings were changed during this preflight.

## Findings

| Area                | Existing implementation                                                                                      | Work required for v1                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication      | Supabase SSR adapter; email signup/login and separate Google login entry point                               | Name/confirm-password fields, 10-character complexity policy, verification/resend screens, recovery, reauthenticated password change, optional TOTP                                   |
| Sessions            | Server API identity comes from `getUser`; proxy refreshes tokens                                             | Protected pages currently render without a server authentication gate; validate verified identity and cookie behavior; fail closed on missing production configuration                |
| Ownership           | Private rows use `user_id`; composite foreign keys and owner RLS exist                                       | Add workspaces/membership, backfill existing owners, migrate private policies/queries/RPCs and preserve actor audit fields                                                            |
| Database privileges | RLS policies and restricted Gmail tables exist                                                               | Explicit anonymous/authenticated/service grants, function execution privileges/search paths, hosted security advisors and exhaustive workspace tests                                  |
| Gmail               | Separate consent, state + PKCE, encrypted AES-256-GCM server tokens, refresh/revoke, send reservation limits | Live dedicated-account verification; workspace authorization and actor binding; OAuth abuse limits                                                                                    |
| Account controls    | Export and confirmed deletion exist                                                                          | Recent reauthentication and workspace-owner handling. The `entities.created_by` cascading Auth foreign key must be reviewed to preserve public entities when their creator is deleted |
| Abuse protection    | Send limits; origin checks and Zod on many mutations                                                         | CAPTCHA, provider limits review, shared application limits, graceful 429s, bounded request reading and comprehensive input tests                                                      |
| Browser security    | Escaped React content; nosniff, frame denial and referrer headers                                            | Tested CSP, Permissions-Policy and HTTPS-only HSTS; compiled browser secret checks                                                                                                    |
| Deployment          | Example env, Vercel configuration and local Supabase config                                                  | Real environments, exact HTTPS origins/callbacks, SMTP, backup/recovery verification; prevent production demo fallback                                                                |

No `dangerouslySetInnerHTML` or `eval` was found in application source. This does not replace adversarial testing. Existing database tests exercise owner isolation against a local PostgreSQL harness; they do not establish live Supabase or workspace isolation. A fresh full-history secret scan and full dependency/security test run remain release gates.

## Implementation order after setup

1. Complete Supabase-owned auth flows and server route protection. Validate password policy directly against Auth as well as UI; make profile/default-workspace provisioning idempotent. Add callback purpose and redirect validation, recovery and reauthentication tests.
2. Add deterministic workspace migrations with safe backfill. Update all private queries, RPCs, merges, exports and deletion behavior. Keep provider credentials tied to the authorizing user. Test anonymous access, both directions of A/B CRUD denial, membership changes, public overlays and privileged operations.
3. Integrate CAPTCHA and provider-aware auth limits; implement shared API abuse controls, typed safe errors and request bounds. Harden cookie, header, production configuration and logging behavior. Add optional TOTP if feasible with correct assurance checks.
4. Update architecture, database, security, development, deployment, email and README documentation. Run the repository's actual typecheck/lint/unit/build/E2E/database scripts, dependency audit and secret/bundle checks.
5. Run live two-account isolation and full email/Google auth flows. With dedicated accounts, verify one authorized Gmail send, recipient delivery, Sent folder, metadata and disconnect. Review hosted advisors, SMTP and recovery settings.
6. Only after every release gate passes: change version/changelog, commit, push main, create annotated v1.0.0 tag and GitHub release. Preserve beta tags.

## Required next action: Supabase project

1. Sign in at the [Supabase Dashboard](https://supabase.com/dashboard). Select an organization and create/select a MusicMail project. Record the region and plan. Save the database password in a password manager. Use a separate staging project for controlled test data before production rollout.
2. In the project's Connect/API settings, copy the project URL and public publishable/anon key. Put them directly into the existing ignored `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Put the server secret/service-role key in `SUPABASE_SERVICE_ROLE_KEY`. Never share secret values in chat or commit that file. Keep `MUSICMAIL_DEMO=true` until migrations and the authenticated implementation are ready.
3. In Authentication settings, enable email/password signup and require email confirmation. Set minimum password length to **10** and required characters to lowercase, uppercase, digits and symbols. Enable secure password change/reauthentication. Enable leaked-password protection if the plan supports it; it currently requires Pro or above. Record an unsupported setting as pending, not enabled. See [Supabase password settings](https://supabase.com/docs/guides/auth/password-security).
4. For the staging project's local testing, set Site URL to `http://localhost:3000` and allow the exact redirect `http://localhost:3000/auth/callback`. Production will use the chosen `https://<app-host>` Site URL and exact `https://<app-host>/auth/callback`. Additional recovery callbacks will be documented with the implementation before enabling them. Avoid broad wildcards.
5. Reply with only the **project URL/reference, selected plan, intended application URL, and confirmation that local environment values are saved**. These identify the target without exposing credentials. If a production domain is undecided, say so; local implementation can resume using the staging project.

Do not manually apply schema changes in the dashboard. Workspace/security changes will be reproducible repository migrations. No live project has been configured or verified by this audit.

## Google setup

Create/select a Google Cloud project and configure Google Auth Platform branding, support/contact email and audience. For testing, restrict access to dedicated test accounts. Configure separate Web application OAuth clients for login and Gmail.

**Login client:** authorized JavaScript origins are `http://localhost:3000` and the chosen HTTPS app origin. The redirect URI is the exact Supabase Google provider callback shown in the dashboard, normally `https://<project-ref>.supabase.co/auth/v1/callback`. Put this client's ID and secret in Supabase Authentication → Google provider settings. Request only identity scopes. See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

**Gmail client:** enable the Gmail API; authorize `http://localhost:3000/api/gmail/callback` for local testing and `https://<app-host>/api/gmail/callback` for production. Put this separate client's ID and secret into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. MusicMail currently requests identity plus `gmail.send`; login must not trigger Gmail consent. Public rollout must satisfy the consent/verification requirements Google presents for that configuration.

Generate a 32-byte random base64 key locally (for example using `openssl rand -base64 32`) and save it directly as `APP_ENCRYPTION_KEY` in the ignored environment file and later the deployment's server secret settings. Keep a secure recovery copy; losing it prevents decryption of existing Gmail tokens. Do not send the generated value in chat.

## Remaining dashboard/deployment work

- **SMTP/DNS:** configure a dedicated transactional sender and its provider-specified SPF/DKIM records. Enter SMTP host, port, username, password and sender in Supabase custom SMTP settings. Verify verification/reset/email-change delivery with controlled accounts. Supabase's default mail service is not the production delivery plan. See [custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
- **CAPTCHA:** prepare a Turnstile or hCaptcha widget restricted to the relevant hostnames. Store the server secret in Supabase's CAPTCHA configuration and the public site key in the application environment once integrated. Activate enforcement together with the form integration; enabling it against the current beta would break tokenless requests. See [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).
- **Auth rate limits:** record the project's actual settings and review them against expected traffic and SMTP capacity before changing values. Test retry/429 behavior. See [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).
- **Vercel/domain:** select the project and HTTPS domain; configure isolated preview/production environments and exact callback URLs. Put secrets in hosting environment settings, never repository files. Production must have `MUSICMAIL_DEMO=false` and complete validated configuration before deployment.
- **Recovery/advisors:** verify the selected plan's actual backup retention and restore options; record a recovery procedure for migrations and secret-manager backups. Run Supabase security advisors after migration and resolve findings. Neither backup activation nor advisor clearance has been verified.

## Verification and release record

This preflight changed documentation only. No new full test suite, live Auth test, A/B hosted isolation test, Gmail send, dependency audit or hosted advisor scan was run for v1. Prior beta results are not v1 acceptance results.

Authentication, workspace migration, CAPTCHA, account reauthentication, header hardening and their tests remain implementation work. Live connections and production acceptance are blocked on external configuration. There is no v1 commit, tag, push or release. The repository remains [Nicksuciu7/musicmail](https://github.com/Nicksuciu7/musicmail) at the v0.9.1 baseline, with this preflight document as an uncommitted handoff.
