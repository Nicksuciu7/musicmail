# Public Gmail release preparation — updated 2026-10-14

Gmail's controlled connection, encrypted storage, automatic refresh, self-send, inbox delivery and disconnect/revocation acceptance are complete. This checkpoint concerns access for ordinary users outside Google's test list, separate from optional Google identity sign-in.

## Initial dashboard evidence before the domain transition

The initial inspection of project `musicmail-510518` → Google Auth Platform → Audience showed **External / Testing**, with one test user. **Publish app** was disabled with an instruction to complete Branding. Homepage/privacy links were blank and the existing authorized domain was `musicmail.vercel.app`. Verification Center said verification was not required **because the app was Testing**; this is not a production approval. The owned-domain URLs and authorized domain have since been saved and verified after reload. On October 14, the operator-approved audience change was saved and verified as In production.

Google requires an accurate public homepage, linked public privacy policy and verified domain ownership for the sensitive-scope review. `gmail.send` is sensitive. Testing-mode limits and seven-day refresh-token expiry remain relevant. References: [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [OAuth policies](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## Domain DNS and HTTPS verified

`app.musicmailapp.uk` is attached to the existing Vercel MusicMail project. The operator saved the explicit A record. Public DNS resolves to `76.76.21.21`, Vercel inspection shows the domain configured, and a normal certificate-verified HTTPS request returns HTTP 200 for the MusicMail homepage. Vercel's domain inspection supplies this required record:

| Field         | Value                                               |
| ------------- | --------------------------------------------------- |
| Provider/page | Porkbun → Domain Management → musicmailapp.uk → DNS |
| Type          | A                                                   |
| Host          | app                                                 |
| Answer        | 76.76.21.21                                         |
| TTL           | Provider default                                    |

The saved explicit `app` record takes precedence over parking wildcard DNS. Nameservers and Resend's mail records were not changed. No registrar login/secret is in the repository.

DNS, Vercel status and HTTPS are verified. The coordinated transition is now saved and deployed. The canonical origin is `https://app.musicmailapp.uk`; the old alias redirects safe page requests there. Provider allowlists retain old entries temporarily during the transition.

## Policy preparation

See [factual privacy-policy draft](privacy-policy-draft.md). The operator confirmed **Nicholas Suciu** and **musicmailsupport@gmail.com**. `/privacy` and `/support` and anonymous homepage links are deployed from `256917e` as `dpl_42zAW8zU1XZwEEt5TmTd1jgukJCz` ([inspect](https://vercel.com/nicksuciu7/musicmail/42zAW8zU1XZwEEt5TmTd1jgukJCz)). Both owned/Vercel domains return HTTP 200 with the confirmed operator/contact and homepage links; anonymous private API access still returns 401. Do not invent a company identity, retention promise, processor region, backup deletion guarantee or Google approval. The existing application homepage describes its purpose; public privacy/support links are implemented; terms are optional for current Google brand verification, not a release gate. The notice describes actual retention criteria and provider lifecycles without promising unverified deletion deadlines, and discloses audited administrator support access. Normal-browser QA passes for both anonymous routes at 390/1280px in light/dark with no automated WCAG A/AA violations. Protected `/api/workspace` remains HTTP 401. Homepage privacy navigation and the configured fixed login origin pass. Typecheck/lint, 155 unit tests and the production build pass.

After pages and ownership verification exist, prepare the exact Branding URLs and sensitive-scope justification from the actual send-only implementation. Public audience changes and submission are consequential provider actions; obtain any required action-time confirmation on the concrete prepared configuration. A genuine verification exemption must be established explicitly; Testing is not one for an unrestricted public product.

No v1 version bump, main merge, tag or GitHub release has been made.

## Google ownership proof verified

The operator saved the exact root TXT proof in Porkbun and authorized the prepared Search Console ownership check. Both authoritative Porkbun DNS and a public resolver return the matching proof. Search Console reports **Ownership verified**, using Domain name provider verification for `musicmailapp.uk` and the existing Google project-owner account. Retain the TXT record; never replace unrelated records.

## Coordinated application-origin transition (saved and deployed)

| Service                                 | Transition configuration                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Production `NEXT_PUBLIC_APP_URL` | `https://app.musicmailapp.uk`                                                                                                         |
| Supabase Auth Site URL                  | `https://app.musicmailapp.uk`                                                                                                         |
| Supabase exact redirect allowlist       | `https://app.musicmailapp.uk/auth/callback`, `https://app.musicmailapp.uk/verify-email`, `https://app.musicmailapp.uk/reset-password` |
| Existing Turnstile widget hostname      | Add `app.musicmailapp.uk`; preserve current `musicmail.vercel.app` during transition                                                  |
| Existing Google Web client callback     | `https://app.musicmailapp.uk/api/gmail/callback` only; temporary old callback retired after acceptance                                |
| Google Branding homepage                | `https://app.musicmailapp.uk/` — saved; verified after reload                                                                         |
| Google Branding privacy link            | `https://app.musicmailapp.uk/privacy` — saved; verified after reload                                                                  |
| Google authorized domain                | `musicmailapp.uk` only; saved and verified after reload                                                                               |

No new Google scope or secret is required. Do not switch Vercel's origin before the provider allowlists are ready. The source candidate adds the verified owned origin to explicit hosted-test allowlists while retaining opt-in. Canonical proxy redirects are prepared for GET/HEAD between the two known HTTPS origins only, using the configured origin. POST/PUT/PATCH/DELETE are not forwarded to another host, unknown/preview/local origins are unchanged, and assigning the path prevents protocol-relative open redirects. Public-page login/signup links already use the configured working origin. The operator explicitly approved the coordinated switch. Vercel Production Config, Supabase Site URL/exact redirects, the existing Turnstile hostname list and the existing Google client callback are saved. Google Branding homepage/privacy URLs and the owned authorized domain persist after reload. The operator-approved OAuth audience change is now In production. Branding is verified/published; sensitive-scope review remains pending.

## Transition source validation

Typecheck/lint and the production build pass. **160 unit tests** include five new canonical-origin security cases: exact GET/HEAD destination, real no-store 307 without cookie transfer, no mutation forwarding, hostile/unknown URL boundaries and local/preview/loop preservation. The public-page candidate passed **15 existing optimized browser journeys** and non-demo anonymous/mobile/theme/accessibility QA. Hosted negative CAPTCHA enforcement still passes after deployment. The post-deployment secret scan covers **220 repository files, 409 historical blobs, 18 local and 10 production browser assets** with no known credential exposure. [Public-page CI passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38310721412).

## Deployed transition acceptance

Application commit `890b0a0` is deployed as `dpl_CbhkxSrzTtcWnxhh15sWZRvkQgwb` ([inspect](https://vercel.com/nicksuciu7/musicmail/CbhkxSrzTtcWnxhh15sWZRvkQgwb)). [Candidate CI passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38311738036), including application/browser and database jobs. Vercel build passed and aliases the owned domain.

- Old `/`, `/login`, `/privacy`, `/support`, `/verify-email` and `/reset-password` return a no-store 307 to the matching owned path/query with no Set-Cookie; the owned routes return 200.
- Stale/untrusted Origin submissions fail before Auth with HTTP 400 and `Request origin could not be verified.` Old-origin POST is rejected without a redirect. This guard intentionally uses 400, not 403.
- Anonymous workspace, export, Gmail-connect and admin records/support endpoints return 401.
- Supabase Site URL and all six old/new exact redirect entries persist after reload. Generated recovery links accept the new default and all three exact new paths. No emails were sent; the disposable fixture was removed.
- Google client reload shows both old and owned Gmail callbacks. Cloudflare confirms the same Managed widget's hostname update succeeded; no scope or public site key changed.
- Negative CAPTCHA enforcement passes on the owned origin. The operator confirms a successful Safari login on the owned domain. Hosted Auth automation still times out at the first real challenge before fixture creation; no bypass was used. Hosted admin regression remains open.
- Hosted read-only security review passes: 23 migrations match and all 10 RLS/grant checks pass.
- Secret scan passes across 220 repository files, 421 historical blobs, 18 local and 10 current production browser assets. A separate dashboard-inspection incident exposed the Turnstile secret in a tool result; the operator has completed rotation and a matching private Supabase update, confirmed successful real login, and negative enforcement was reverified afterward. No value is included here or in Git.

New-origin confirmation/recovery inbox completion and provider-dependent regressions remain acceptance gates. The existing SMTP/templates are unchanged; they derive their host from the saved Site URL. No v1 release, version bump, main merge or tag was made.

The post-rotation hosted Auth retry still reports `captcha_timeout` before fixture creation. [CI for the recorded transition passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38314700794), including typecheck, lint, unit, optimized browser, build, dependency and database jobs.

## Post-rotation email-proof and OAuth initiation acceptance

The new `test:hosted:email-tokens` script passes against the owned origin using a disposable fixture. GET/HEAD leave signup/recovery proofs usable; explicit purpose-bound redemption, strict Origin checks, password requirements, host-bound Secure/HttpOnly/Lax cookies, replay rejection and reset logout pass. The production Gmail initiation response points to the exact owned callback with send-only scopes and checked PKCE/state/user/ten-minute binding; invalid callbacks clear state and return to fixed Settings. No Google consent was followed, no mail was sent, no token/cookie state was persisted, and the fixture was removed. These checks supplement, without weakening, the existing CAPTCHA-gated Auth/admin suites.

After owned-origin login and initiation checks, the temporary old Vercel Gmail callback was removed from the existing Google client. Reopening its saved configuration shows only `https://app.musicmailapp.uk/api/gmail/callback`. This narrows the allowlist; no secret or scope changed. Old application page links still redirect.

Google Branding now contains only the verified `musicmailapp.uk` authorized domain. The retired Vercel domain was removed after its client callback was retired; homepage/privacy URLs and the narrowed domain list persist after reload. OAuth Audience is now In production after the operator-approved change.

## Google production audience and review preparation — October 14

The operator explicitly approved changing the existing external OAuth app to production. Audience → Publish app → Confirm completed, and the saved page displays **In production** with **Back to testing**. No runtime permission or credential changed.

The saved Data Access list was empty: the earlier verification-not-required message did not reflect MusicMail's actual requests. The existing runtime scopes were declared as `openid`, `https://www.googleapis.com/auth/userinfo.email` (Google's canonical declaration for runtime `email`) and `https://www.googleapis.com/auth/gmail.send`. The sensitive send scope, two non-sensitive identity scopes and the 695-character factual justification persist after reload; no restricted scope was added.

Google's automated brand check passed. Publish branding completed; Branding and Verification Center state **Your branding has been verified and is being shown to users.** Data access is explicitly **not verified**. Prepare for verification identifies the missing field as **demo video**. The final review was not submitted and no approval is claimed. See the [exact video handoff and saved justification](google-verification-demo.md). This is a genuine remaining release gate; the production audience setting alone does not complete public Gmail readiness.

Independent October 14 checks pass: owned-origin email-proof/OAuth-initiation acceptance, 23 hosted migrations/10 RLS-grant checks, and 157 fresh bidirectional A/B isolation assertions with fixture cleanup. Production dependencies have zero audit findings; the same five narrowly reviewed development-only findings remain visible. Lint passes. Final provider-dependent acceptance remains open.
