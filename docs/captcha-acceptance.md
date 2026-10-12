# Production CAPTCHA checkpoint — 2026-10-12

The Cloudflare account is signed in and a widget named **MusicMail production authentication** has been created. It uses **Managed** mode, allows only `musicmail.vercel.app`, and leaves pre-clearance disabled. Local development can use a separate widget; localhost is not allowed by this production widget.

Its public site key is configured in Vercel Production as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with type Config. The matching secret remains in Cloudflare and must be entered privately in Supabase; it is not required in Vercel, local env files or application source. Supabase Auth performs the one-time server-side token verification. See [Supabase CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha) and [Cloudflare widget management](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

The public widget was deployed from application commit `232d237` in deployment `dpl_G8Fyg9XXhFuy9GDximUGGWtECnDX`, aliased to https://musicmail.vercel.app. The Vercel build passed. The secret scan passed across **213 repository files, 385 historical blobs, 18 local and 10 production browser assets** before this documentation addition.

The production widget script, response input and Cloudflare challenge frame load on **login, signup and password recovery** with **zero CSP errors**. All four public Auth actions (signup, login, forgot and resend) reject a missing challenge token with HTTP 400 before any provider email/account operation. A first iframe locator could not see the frame inside the widget; checking Playwright's actual frame list confirms its presence. Successful challenge acceptance is not claimed: one automated browser attempt encountered a Cloudflare fetch DNS failure and did not receive a response token. No CAPTCHA was bypassed, token fabricated, form submitted or email sent by those rendering checks.

## Exact remaining private configuration

Supabase **Authentication → Attack Protection → Bot and Abuse Protection** is open at:

`https://supabase.com/dashboard/project/thkrltiusxylpzqwfasx/auth/protection`

The form is prepared with CAPTCHA on and **Turnstile by Cloudflare** selected, but remains **unsaved**. The operator must copy the matching widget's Secret key from the existing Cloudflare tab into **Captcha secret**, then select **Save changes**. Never send the secret through chat or put it in source code.

After saving, run `node --env-file=.env.local scripts/check-hosted-captcha.mjs` to verify provider invalid-token rejection, production widget presence, missing-token rejection on signup/login/recovery/resend, and safe invalid-token recovery rejection. Complete a real managed challenge and verify a successful authenticated request, then rerun the provider-dependent hosted acceptance and final release checks. If the browser requires an interactive challenge, the operator must complete it; do not bypass it or weaken protection for automated tests.

CAPTCHA activation and successful live acceptance remain a release gate. See [current production release decision](google-gmail-acceptance.md#release-decision).
