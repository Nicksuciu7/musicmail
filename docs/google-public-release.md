# Public Gmail release preparation — 2026-10-12

Gmail's controlled connection, encrypted storage, automatic refresh, self-send, inbox delivery and disconnect/revocation acceptance are complete. This checkpoint concerns access for ordinary users outside Google's test list, separate from optional Google identity sign-in.

## Initial dashboard evidence before the domain transition

The initial inspection of project `musicmail-510518` → Google Auth Platform → Audience showed **External / Testing**, with one test user. **Publish app** was disabled with an instruction to complete Branding. Homepage/privacy links were blank and the existing authorized domain was `musicmail.vercel.app`. Verification Center said verification was not required **because the app was Testing**; this is not a production approval. The owned-domain URLs have since been entered/saved; final dashboard persistence and publishing readiness are still to be verified after a browser-control timeout.

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
| Existing Google Web client callback     | Add `https://app.musicmailapp.uk/api/gmail/callback`; preserve current callback during transition                                     |
| Google Branding homepage                | `https://app.musicmailapp.uk/` — entered/saved; final persistence review pending                                                      |
| Google Branding privacy link            | `https://app.musicmailapp.uk/privacy` — entered/saved; final persistence review pending                                               |
| Google authorized domain                | `musicmailapp.uk` once ownership is verified                                                                                          |

No new Google scope or secret is required. Do not switch Vercel's origin before the provider allowlists are ready. The source candidate adds the verified owned origin to explicit hosted-test allowlists while retaining opt-in. Canonical proxy redirects are prepared for GET/HEAD between the two known HTTPS origins only, using the configured origin. POST/PUT/PATCH/DELETE are not forwarded to another host, unknown/preview/local origins are unchanged, and assigning the path prevents protocol-relative open redirects. Public-page login/signup links already use the configured working origin. The operator explicitly approved the coordinated switch. Vercel Production Config, Supabase Site URL/exact redirects, the existing Turnstile hostname list and the existing Google client callback are saved. Google Branding homepage/privacy URLs are prepared; their persisted state needs final dashboard verification. Public Gmail publication and sensitive-scope review remain pending.

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
- Secret scan passes across 220 repository files, 421 historical blobs, 18 local and 10 current production browser assets. A separate dashboard-inspection incident exposed the Turnstile secret in a tool result; operator rotation and matching Supabase update are required before release. No value is included here or in Git.

New-origin confirmation/recovery inbox completion and provider-dependent regressions remain acceptance gates. The existing SMTP/templates are unchanged; they derive their host from the saved Site URL. No v1 release, version bump, main merge or tag was made.
