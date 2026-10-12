# Production provider checkpoint — 2026-10-12

The combined foundation, Calendar/appearance and administrator candidate is live at **https://musicmail.vercel.app**. Version remains **0.9.1**; main and release tags are unchanged.

Application commit: `63f3d2f60f0f4b4268e78cd87531e969a87874d7` on `feature/admin-security`. Vercel deployment: `dpl_8gdYvX5hEdLgg9jWb8a5gaAW6v9t` ([inspect](https://vercel.com/nicksuciu7/musicmail/8gdYvX5hEdLgg9jWb8a5gaAW6v9t)). [Both GitHub CI jobs passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38264503857).

## Configuration and security

- Vercel confirms `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are **Sensitive Production** variables. No credential values were downloaded, printed or added to Git. Google identity sign-in remains separate and optional.
- The previous production lockfile had new Next/source-map-js findings. Compatible patches to **Next 16.3.8** (matching lint configuration) and **source-map-js 1.2.2** restore a **zero-finding production audit**. The existing five development-only braces findings remain visible and narrowly reviewed; see [dependency review](dependency-audit.md).
- Production CAPTCHA probe with a deliberately invalid token returns `invalid_credentials`, not `captcha_failed`; enforcement is still not verified. No challenge bypass or settings change was made.

## Automated results

| Check                                               | Result                                                                                                                                                                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh Node 22/npm 10 `npm ci`                       | Passed; platform lock entries preserved                                                                                                                                                                                                       |
| Typecheck / lint / unit                             | Passed; **155 tests in 10 files**                                                                                                                                                                                                             |
| Build                                               | Next 16.3.8 passed locally and on Vercel                                                                                                                                                                                                      |
| Optimized local Chromium suite                      | **14 passed**                                                                                                                                                                                                                                 |
| PostgreSQL migrations/RLS suite                     | All **23 migrations**, seed repeatability and legacy regressions passed, including **61 Calendar + 95 admin assertions**                                                                                                                      |
| Hosted migration/grant checks                       | **10 passed**; 23 ledger entries match, all public tables have RLS                                                                                                                                                                            |
| Hosted member A/B isolation                         | **157 passed** both directions, same permitted canonical entity and separate private overlays                                                                                                                                                 |
| Production administrator acceptance                 | **1,202 passed**, including cross-workspace support, role/canonical audit, session revocation, concurrency, cookie protection and light/dark/mobile accessibility                                                                             |
| Production Auth/CRM/Calendar/Gmail-start acceptance | **111 passed**: verification/recovery/change, private CRUD, 1,002-event export, appearance, deletion, OAuth callback/scope/state/PKCE/10-minute cookie and invalid-callback rejection                                                         |
| Secret scan                                         | **212 repository files, 366 historical blobs, 18 local and 10 current production browser assets** passed; known private values, provider-secret patterns (including Google), private env tracking and server-secret browser references absent |

Test accounts and business records are disposable and removed in `finally`. Immutable, credential-free admin audit evidence is retained. These tests do not send Auth or Gmail emails. A test-clock comparison was corrected to compare the OAuth deadline with the server's second-resolution HTTP Date and require the exact `Max-Age=600` cookie; state, identity, PKCE and callback assertions remain enforced.

## Gmail acceptance

### Connection follow-up

The reported connection was checked against both production storage and the current Safari page: **zero saved Gmail connections**, `/settings?gmail=failed`, and the Email section still offering Connect Gmail. Google Cloud's MusicMail project (`musicmail-510518`) is External/Testing and includes the operator's account as a test user. The older generic callback logs do not establish the underlying failure reason; successful token exchange is not claimed.

A UI race was found and fixed: the workspace refresh cleared the callback error immediately after loading. The failure now stays beside the Email controls and survives subsequent workspace refreshes. Connection success still comes from saved server data, never the `gmail=connected` query string. Typecheck, lint, **155 unit tests**, build and **15 Chromium tests** pass, including a regression for persistent failure feedback and forged success parameters. A fresh connection attempt with send permission is pending; no test email was sent or token revoked.

The feedback fix is deployed from `e8808e8` as `dpl_GiPVKniCGKmfuqqAcGKDkoreCBFq`, aliased to the production URL. [GitHub CI passed](https://github.com/Nicksuciu7/musicmail/actions/runs/38274389297). A disposable-account production browser check confirms the failure survives loading and account refresh, and a success query parameter cannot fabricate a connection; the fixture was removed. The subsequent secret scan passed across **213 repository files, 376 historical blobs, 18 local and 10 production browser assets**. Google Cloud Data Access now lists `gmail.send`; this configuration is separate from the operator granting consent through MusicMail. A saved connection remains unverified.

### Successful connection, refresh and controlled send

The operator completed fresh Google consent. Production Settings shows the connected address, and the saved connection belongs to the same verified Auth account. Both access and refresh tokens decrypt successfully from AES-GCM encrypted server storage; no token values were printed or written to artifacts.

One disposable private self-test contact was created through the production UI. One reviewed message, subject `MusicMail v1 Gmail acceptance self-test`, was sent from the connected account to itself. Production reported **Sent successfully**, and the matching message was visible in the recipient's Gmail inbox. The expired access token refreshed automatically during this send and the renewed token was encrypted back into storage. Read-only storage verification confirms exactly one successful attempt, a Gmail message ID, the expected recipient/subject/body, matching private workspace ownership, contact status `sent`, and `email_sent`/`outreach_status_changed` interactions. No retry was performed. The disposable test contact is archived, keeping its private send history as acceptance evidence; no unrelated contacts were modified.

The registered callback, Gmail API availability, configured client credentials and granted send scope are now exercised by a real exchange and send. The operator explicitly authorized disconnect/revocation. The real production Settings action removed the saved connection and restored the Connect Gmail control without a revocation warning. A token held only in process memory was accepted by Google before disconnect (HTTP 200) and rejected afterward (HTTP 401). A read-only database check confirms zero remaining connection rows for that account. No token was persisted to an artifact. Gmail connection, refresh, send, delivery and disconnect/revocation acceptance are complete; reconnecting requires fresh operator consent.

Google's app is still External/Testing with the operator listed as a test user. Testing-mode refresh tokens expire after seven days when Gmail scopes are requested; public availability and Google's sensitive-scope verification requirements must be addressed before claiming unrestricted public Gmail readiness. See [Google token expiration](https://developers.google.com/identity/protocols/oauth2) and [sensitive-scope production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). This limitation does not prevent the controlled acceptance result above.

## Release decision

**No v1 publication.** Remaining gates are public Gmail audience/verification readiness, Turnstile production activation and successful challenge acceptance, then final checks after those provider changes and the main/release preparation. Existing verified SMTP and confirmation/recovery evidence remains valid; no repeat manual email test is requested.
