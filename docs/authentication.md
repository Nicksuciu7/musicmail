# Authentication

Current evidence (2026-10-12): production Auth/CRM/Calendar/Gmail-start smoke passes 111 assertions. Actual signup confirmation and password-reset delivery/completion are operator-verified; confirmation was also independently checked in Supabase. Resend SMTP and branded templates are active. Gmail consent, refresh, self-send/delivery and revocation passed. CAPTCHA enforcement is active; normal-browser challenge/login acceptance passed; hosted automation after activation and public Google readiness remain pending. See [production checkpoint](google-gmail-acceptance.md), [CAPTCHA checkpoint](captcha-acceptance.md) and [confirmation investigation](confirmation-link-verification.md).

## Identity and passwords

Supabase Auth owns all passwords. Signup collects name/email/password/confirmation; UI and server require at least 10 characters, uppercase, lowercase, number and symbol. The hosted policy was independently tested with weak/strong passwords. Account metadata never grants privileges. Signup provisioning creates an idempotent profile and personal workspace.

Pages and APIs use verified `getUser` identity. Unconfirmed accounts cannot enter the workspace. SSR cookies are HttpOnly, SameSite=Lax and Secure on HTTPS; no browser Auth client or token localStorage. Proxy refreshes signed claims; `getSession` is not authorization.

Current-password proof is required for password change. Reset requires a one-time `recovery` email proof, or signature-verified recovery AMR plus an expiring single-use server grant for development PKCE. Query flags/ordinary sessions cannot authorize reset. Successful change/reset globally signs out refresh sessions; existing access JWTs can remain valid until provider expiry. Deletion requires recent password/OAuth authentication within five minutes or fresh current-password proof, with database-enforced workspace cleanup.

## Production email and URLs

Supabase project: `thkrltiusxylpzqwfasx`. Site URL: `https://musicmail.vercel.app`. Verified exact redirects:

- `https://musicmail.vercel.app/auth/callback`
- `https://musicmail.vercel.app/verify-email`
- `https://musicmail.vercel.app/reset-password`

Do not replace production Site URL with localhost or add wildcards. Local development uses `http://localhost:3000` and the corresponding three exact redirects in a local/separate configuration. Callback destinations come from the configured origin, never request parameters.

Custom SMTP is already enabled: `smtp.resend.com:465`, username `resend`, sender `MusicMail <hello@auth.musicmailapp.uk>`, per-user interval 60 seconds. Its Resend API key is private in Supabase SMTP settings only. Branded subjects/templates are saved from `supabase/templates/confirmation.html` and `recovery.html`. Do not rebuild this working setup.

Confirmation links use `{{ .SiteURL }}/verify-email#token_hash={{ .TokenHash }}`; recovery uses `/reset-password#token_hash={{ .TokenHash }}`. Both support bounded hexadecimal and `pkce_`-prefixed hashes. Opening/GET/HEAD never redeems a token: explicit click/submission POSTs it to Auth with fixed signup/recovery purpose. Tokens are removed from the visible URL after loading; replay/expired proofs fail. Fragment links support another browser/device. Supabase default development templates use the same-browser PKCE callback, which remains supported.

## CAPTCHA

The managed Turnstile widget obtains `captchaToken`; Supabase Auth performs server-side verification using the secret in its dashboard. No duplicate Siteverify call or application `TURNSTILE_SECRET_KEY` is needed: tokens are single-use.

The production Managed widget for `musicmail.vercel.app` is created, its public site key is saved in Vercel Production as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the widget is deployed. Use a separate widget for localhost development. In Supabase Authentication → Bot and Abuse Protection/Attack Protection → CAPTCHA, choose Turnstile, save the matching secret and enable enforcement. The operator saved the matching secret privately; invalid-token provider rejection and all four missing-token guards pass. Never put the secret in browser variables or chat. See [CAPTCHA configuration and live evidence](captcha-acceptance.md).

Signup, reset requests, resend and login require a challenge when configured. Password-change reauthentication receives a challenge too. Expired/failed challenges clear stale tokens; each submission remounts the widget. Provider CAPTCHA failures are surfaced safely, including reset/resend. Unconfigured local demo uses no widget and cannot authenticate or send email. Production CAPTCHA enforcement is active; the operator completed normal-browser challenge/login successfully. Hosted Auth/admin regression after activation remains pending.

## Rate limits

Hosted Authentication → Rate Limits were inspected on 2026-10-03 and retained:

| Operation                                            | Hosted value         |
| ---------------------------------------------------- | -------------------- |
| Auth email sending (signup/recovery/resend combined) | 30/hour per project  |
| Signup/signin operations                             | 30/5 minutes per IP  |
| Verification                                         | 30/5 minutes per IP  |
| Token grants/refresh                                 | 150/5 minutes per IP |
| Signup/recovery/resend interval                      | 60 seconds per user  |
| IP forwarding                                        | Off                  |

These are appropriate for controlled initial acceptance. Do not raise them to bypass test throttling. Monitor SMTP capacity and shared server-IP contention as traffic grows. Additional atomic application limits: login 10/10 minutes per normalized email; signup/reset/resend combined 3/hour; auth overall 300/minute. See [security](security.md) for authenticated-route limits. Shared-limit 429s include Retry-After; provider 429s use safe messaging without inventing a retry duration. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Optional Google identity

Google login is hidden by `GOOGLE_AUTH_ENABLED=false`, independent of Gmail. If enabled later, configure its separate client in Supabase Google provider settings with callback `https://thkrltiusxylpzqwfasx.supabase.co/auth/v1/callback`; scopes are only `openid email profile`. Application `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` belong to Gmail, not identity login. Google login and MFA are future features, not v1 blockers.

## Reproducible acceptance

`npm test` covers Auth handlers, inputs, recovery grants and widget failures. `npm run test:db` covers PostgreSQL ownership/rates. `npm run test:hosted:auth` accepts exact localhost:3000 in non-demo mode, or production with `NEXT_PUBLIC_APP_URL=https://musicmail.vercel.app MUSICMAIL_LIVE_ACCEPTANCE=true`. It creates/removes a disposable fixture and tests Auth/CRM without SMTP mail. The hosted isolation suite obtains real user JWTs using disposable admin-generated email proofs, then tests Data API RLS using user clients only.

`node --env-file=.env.local scripts/check-hosted-captcha.mjs` checks negative production enforcement without creating users or sending email. Successful real-widget use is checked by browser smoke. Admin-generated token tests do not prove SMTP delivery; inbox evidence is recorded separately. Never use unrelated projects or personal production credentials in public CI. [Supabase CAPTCHA architecture](https://supabase.com/docs/guides/auth/auth-captcha).
