# Confirmation-link investigation — 2026-10-03

The production confirmation failure was caused by MusicMail rejecting Supabase's `pkce_`-prefixed token hashes before contacting Auth. The client validator accepted hexadecimal hashes only and mislabeled the rejected format as expired. The received tokens had the `pkce_` prefix and 56 hexadecimal characters. No secret/token value is included here.

## Evidence and fix

- Reviewed the visible last-hour Supabase Auth log window. Signup/resend requests, repeated signup, unconfirmed login errors and a resend interval 429 were present. No `/verify` calls or `otp_expired` events corresponding to the reported failures were visible. This is evidence of rejection before Auth, not proof that every historical token remained valid.
- The actual received confirmation links went directly to `https://musicmail.vercel.app/verify-email#token_hash=…`; they were not rewritten to a tracking host. The Resend domain Configuration screen offered tracking setup, but detailed tracking settings could not be inspected after browser access was blocked. No tracking configuration was changed.
- The saved template deliberately uses `{{ .TokenHash }}` instead of `{{ .ConfirmationURL }}`. This supported Supabase pattern opens the MusicMail page first. GET/HEAD and page load do not verify the account. Only the explicit Verify email button POSTs to the application, which calls Supabase `verifyOtp` with `type: signup`. Token hashes are removed from the visible URL after loading. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
- Validation now permits bounded hexadecimal hashes with the optional provider `pkce_` prefix and passes the original value unchanged to Supabase. The same format support applies to password-recovery tokens while preserving `type: recovery`. Malformed tokens are described as malformed, not expired. No email-confirmation requirement, token lifetime, one-time rule or purpose check was bypassed.
- Repeated requests were visible and can make older emails stale. The final inbox retest used exactly one fresh signup request and no resend.

## Verification

Typecheck, lint, build and 72 unit tests passed, including supported prefixed hashes, malformed inputs, provider rejection of expired/used hashes, and recovery-purpose preservation. The fix was deployed to `https://musicmail.vercel.app` as Vercel deployment `dpl_H3DjgJMTnfSSLiNQFJVvHXYWfHGd`.

`scripts/test-hosted-confirmation.mjs` passed against the production site using a disposable generated-token fixture without sending mail: GET/HEAD and opening the page left the account unconfirmed, explicit click confirmed it, replay was rejected, cookies were Secure/HttpOnly/Lax, and a nonexistent prefixed token reached the provider and failed. Fixture removed.

One real fresh signup email was sent through the production application/SMTP to the operator's Gmail inbox via a unique plus-address. The operator reported “my email is verified” after opening the email and clicking Verify email. The account's `email_confirmed_at` was independently checked with Supabase Auth. Only that disposable test account was then removed. No passwords, links or tokens were stored in this report.

## Subsequent acceptance

The operator subsequently confirmed password-reset delivery/completion and DMARC setup. Production Auth/CRM smoke verifies reset/change and deletion. The five development audit findings are now reviewed as non-blocking in [dependency-audit.md](dependency-audit.md). Current CAPTCHA/Gmail blockers and final checks are authoritative in [v1-acceptance.md](v1-acceptance.md). No v1 tag/release exists.
