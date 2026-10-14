# Production CAPTCHA checkpoint — 2026-10-12

The Cloudflare account is signed in and a widget named **MusicMail production authentication** has been created. It uses **Managed** mode, allows `app.musicmailapp.uk` and temporarily retains `musicmail.vercel.app`, and leaves pre-clearance disabled. Local development can use a separate widget; localhost is not allowed by this production widget.

Its public site key is configured in Vercel Production as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with type Config. The operator saved the matching secret privately in Supabase; it is not required in Vercel, local env files or application source. Supabase Auth performs the one-time server-side token verification. See [Supabase CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha) and [Cloudflare widget management](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

The public widget was deployed from application commit `232d237` in deployment `dpl_G8Fyg9XXhFuy9GDximUGGWtECnDX`, aliased to https://musicmail.vercel.app. The Vercel build passed. The secret scan passed across **213 repository files, 385 historical blobs, 18 local and 10 production browser assets** before this documentation addition.

The production widget script, response input and Cloudflare challenge frame load on **login, signup and password recovery** with **zero CSP errors**. All four public Auth actions (signup, login, forgot and resend) reject a missing challenge token with HTTP 400 before any provider email/account operation. A first iframe locator could not see the frame inside the widget; checking Playwright's actual frame list confirms its presence. Safari shows the real widget completing with **Success!**. The operator completed login successfully through that widget, and the same Safari tab reached the protected Home page. Read-only Supabase inspection independently confirms a recent login for the verified account. Automated hosted acceptance remains incomplete: the headless hosted Auth run timed out waiting for a response token, and an earlier attempt encountered a Cloudflare fetch DNS failure. No CAPTCHA was bypassed, token fabricated, form submitted or email sent by those rendering checks.

## Saved provider configuration and enforcement

The operator saved CAPTCHA protection in Supabase **Authentication → Attack Protection → Bot and Abuse Protection**, using **Turnstile by Cloudflare** and the matching widget secret. No secret was copied to chat, Git or application configuration.

`node --env-file=.env.local scripts/check-hosted-captcha.mjs` passes: direct Supabase login rejects an invalid token with `captcha_failed`, all four public MusicMail Auth actions reject missing tokens, and recovery rejects an invalid token safely. No account is created or email sent by this negative test. Supabase CAPTCHA enforcement is active.

The hosted Auth test stopped at the first challenge wait before any fixture signup or mail operation. It has not passed after activation. The hosted administrator runner now obtains a genuine challenge before password login too. Both runners support `MUSICMAIL_ACCEPTANCE_HEADED=true` for a visible browser; they never fabricate tokens or disable provider enforcement. If an interactive challenge appears, the operator must complete it.

## Successful normal-browser acceptance and remaining automation

The operator confirms the production login succeeded after the managed challenge. End-to-end CAPTCHA enforcement and normal-browser Auth acceptance are complete. The visible Chromium retry also stopped at the challenge stage before fixture creation; neither hosted Auth run is counted as passed after activation. The updated hosted administrator run also stops at `captcha_timeout`; its disposable account is removed in `finally`. Complete provider-dependent hosted Auth/admin regression acceptance and final release checks.

After activation, typecheck/lint, **155 unit tests**, the production build, **15 optimized local browser journeys**, the complete PostgreSQL suite, **10 hosted schema/grant checks**, and **157 bidirectional isolation assertions** pass. The refreshed secret scan passes across **217 repository files, 389 historical blobs, 18 local and 10 production browser assets**. Production dependencies have zero audit findings; five reviewed development-only findings remain visible. See [current production release decision](google-gmail-acceptance.md#release-decision).

## Owned-origin transition

The operator approved adding the owned hostname to the same Managed widget. Cloudflare confirms the saved update succeeded. The application is deployed on https://app.musicmailapp.uk from `890b0a0`; missing/invalid-token enforcement passes there, and the operator confirms successful real Safari login. The new-origin automated Auth run still stops at `captcha_timeout` before fixture creation. No CAPTCHA bypass or test key was used.

A dashboard-inspection tool result inadvertently included the widget secret. It was not added to source or Git. The operator rotated the secret in Cloudflare, saved its replacement directly in Supabase, and confirmed real login still works on the owned origin. The subsequent negative enforcement check passes with CAPTCHA still active. The rotation blocker is resolved; neither credential is in source or Git. Hosted Auth was retried after rotation and still stops at the genuine challenge before fixture creation.
