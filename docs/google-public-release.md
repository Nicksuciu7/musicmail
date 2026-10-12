# Public Gmail release preparation — 2026-10-12

Gmail's controlled connection, encrypted storage, automatic refresh, self-send, inbox delivery and disconnect/revocation acceptance are complete. This checkpoint concerns access for ordinary users outside Google's test list, separate from optional Google identity sign-in.

## Dashboard evidence

Project `musicmail-510518` → Google Auth Platform → Audience is **External / Testing**, with one test user. **Publish app** is disabled with an instruction to complete Branding. Branding has MusicMail's name and existing support email, but Application home page, privacy policy and terms links are blank. Its existing authorized domain is `musicmail.vercel.app`. Verification Center says verification is not required **because the app is Testing**; this is not a production approval.

Google requires an accurate public homepage, linked public privacy policy and verified domain ownership for the sensitive-scope review. `gmail.send` is sensitive. Testing-mode limits and seven-day refresh-token expiry remain relevant. References: [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [OAuth policies](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## Prepared domain and exact pending DNS operation

`app.musicmailapp.uk` is attached to the existing Vercel MusicMail project. Its current DNS follows Porkbun's parking CNAME, not the application. Vercel's domain inspection supplies this required record:

| Field         | Value                                               |
| ------------- | --------------------------------------------------- |
| Provider/page | Porkbun → Domain Management → musicmailapp.uk → DNS |
| Type          | A                                                   |
| Host          | app                                                 |
| Answer        | 76.76.21.21                                         |
| TTL           | Provider default                                    |

Save that record. Do not change nameservers, root/wildcard records or Resend's `auth`/mail records. The explicit `app` record takes precedence over parking wildcard DNS. No registrar login/secret is in the repository. DNS editing remains an operator action because the registrar session is unavailable.

After saving, verify authoritative/public DNS, Vercel domain status and HTTPS. The current working origin remains `https://musicmail.vercel.app`; no Auth origin, Supabase redirect, Gmail callback or Turnstile hostname is changed prematurely. Before switching the application origin, prepare exact coordinated Supabase/Vercel/Google/Turnstile changes, preserve the existing working path during transition, and re-run acceptance. Domain attachment alone does not complete that transition.

## Policy preparation

See [factual privacy-policy draft](privacy-policy-draft.md). Operator identity/contact are requested before converting the draft into public application pages. Do not invent a company identity, retention promise, processor region, backup deletion guarantee or Google approval. The existing application homepage describes its purpose; public privacy/terms links still need implementation once the policy details are confirmed. Provider-controlled logs/backups need an explicit retention decision before making corresponding promises.

After pages and ownership verification exist, prepare the exact Branding URLs and sensitive-scope justification from the actual send-only implementation. Public audience changes and submission are consequential provider actions; obtain any required action-time confirmation on the concrete prepared configuration. A genuine verification exemption must be established explicitly; Testing is not one for an unrestricted public product.

No v1 version bump, main merge, tag or GitHub release has been made.
