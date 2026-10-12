# Public Gmail release preparation — 2026-10-12

Gmail's controlled connection, encrypted storage, automatic refresh, self-send, inbox delivery and disconnect/revocation acceptance are complete. This checkpoint concerns access for ordinary users outside Google's test list, separate from optional Google identity sign-in.

## Dashboard evidence

Project `musicmail-510518` → Google Auth Platform → Audience is **External / Testing**, with one test user. **Publish app** is disabled with an instruction to complete Branding. Branding has MusicMail's name and existing support email, but Application home page, privacy policy and terms links are blank. Its existing authorized domain is `musicmail.vercel.app`. Verification Center says verification is not required **because the app is Testing**; this is not a production approval.

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

DNS, Vercel status and HTTPS are verified. The current working origin remains `https://musicmail.vercel.app`; no Auth origin, Supabase redirect, Gmail callback or Turnstile hostname is changed prematurely. Before switching the application origin, prepare exact coordinated Supabase/Vercel/Google/Turnstile changes, preserve the existing working path during transition, and re-run acceptance. Domain attachment alone does not complete that transition.

## Policy preparation

See [factual privacy-policy draft](privacy-policy-draft.md). The operator confirmed **Nicholas Suciu** and **musicmailsupport@gmail.com**. `/privacy` and `/support` and anonymous homepage links are deployed from `256917e` as `dpl_42zAW8zU1XZwEEt5TmTd1jgukJCz` ([inspect](https://vercel.com/nicksuciu7/musicmail/42zAW8zU1XZwEEt5TmTd1jgukJCz)). Both owned/Vercel domains return HTTP 200 with the confirmed operator/contact and homepage links; anonymous private API access still returns 401. Do not invent a company identity, retention promise, processor region, backup deletion guarantee or Google approval. The existing application homepage describes its purpose; public privacy/support links are implemented; terms are optional for current Google brand verification, not a release gate. The notice describes actual retention criteria and provider lifecycles without promising unverified deletion deadlines, and discloses audited administrator support access. Normal-browser QA passes for both anonymous routes at 390/1280px in light/dark with no automated WCAG A/AA violations. Protected `/api/workspace` remains HTTP 401. Homepage privacy navigation and the configured fixed login origin pass. Typecheck/lint, 155 unit tests and the production build pass.

After pages and ownership verification exist, prepare the exact Branding URLs and sensitive-scope justification from the actual send-only implementation. Public audience changes and submission are consequential provider actions; obtain any required action-time confirmation on the concrete prepared configuration. A genuine verification exemption must be established explicitly; Testing is not one for an unrestricted public product.

No v1 version bump, main merge, tag or GitHub release has been made.

## Google ownership proof prepared

Search Console is signed into the existing project-owner Google account. A Domain property for `musicmailapp.uk` is prepared and its DNS-verification dialog is open. The public TXT proof has been provided directly to the operator for Porkbun root DNS. The operator saved the exact root TXT record and replied to the prepared verification handoff. Both authoritative Porkbun DNS and a public resolver return the matching proof. Search Console reports **Ownership verified**, using Domain name provider verification. Ownership is verified for the existing Google project-owner account; retain the TXT record. Never replace existing unrelated TXT records.

## Coordinated application-origin transition (prepared, not saved)

| Service                                 | Exact intended value                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Production `NEXT_PUBLIC_APP_URL` | `https://app.musicmailapp.uk`                                                                                                         |
| Supabase Auth Site URL                  | `https://app.musicmailapp.uk`                                                                                                         |
| Supabase exact redirect allowlist       | `https://app.musicmailapp.uk/auth/callback`, `https://app.musicmailapp.uk/verify-email`, `https://app.musicmailapp.uk/reset-password` |
| Existing Turnstile widget hostname      | Add `app.musicmailapp.uk`; preserve current `musicmail.vercel.app` during transition                                                  |
| Existing Google Web client callback     | Add `https://app.musicmailapp.uk/api/gmail/callback`; preserve current callback during transition                                     |
| Google Branding homepage                | `https://app.musicmailapp.uk/`                                                                                                        |
| Google Branding privacy link            | `https://app.musicmailapp.uk/privacy`                                                                                                 |
| Google authorized domain                | `musicmailapp.uk` once ownership is verified                                                                                          |

No new Google scope or secret is required. Do not switch Vercel's origin before the provider allowlists are ready. The source candidate adds the verified owned origin to explicit hosted-test allowlists while retaining opt-in. Canonical proxy redirects are prepared for GET/HEAD between the two known HTTPS origins only, using the configured origin. POST/PUT/PATCH/DELETE are not forwarded to another host, unknown/preview/local origins are unchanged, and assigning the path prevents protocol-relative open redirects. Public-page login/signup links already use the configured working origin. No provider URL or production origin has been switched yet. Public Gmail publication and sensitive-scope review remain pending.

## Transition source validation

Typecheck/lint and the production build pass. **160 unit tests** include five new canonical-origin security cases: exact GET/HEAD destination, real no-store 307 without cookie transfer, no mutation forwarding, hostile/unknown URL boundaries and local/preview/loop preservation. The public-page candidate passed **15 existing optimized browser journeys** and non-demo anonymous/mobile/theme/accessibility QA. Hosted negative CAPTCHA enforcement still passes after deployment. The post-deployment secret scan covers **220 repository files, 409 historical blobs, 18 local and 10 production browser assets** with no known credential exposure. [Public-page CI passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38310721412).

Canonical routing/provider-transition source is prepared but not yet deployed, so the owned public homepage/privacy/support pages currently retain the working Vercel Auth links. Updating the Google client's approved redirect target requires the browser-control action-time confirmation; the exact intended settings are listed above. No secret rotation, broader Google scope or v1 publication is part of that operation.
