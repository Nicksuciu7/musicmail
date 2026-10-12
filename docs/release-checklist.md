# MusicMail v1.0.0 release gates

Updated 2026-10-12. Published version remains 0.9.1. See [current production acceptance and evidence](google-gmail-acceptance.md).

## Completed candidate gates

- [x] Hosted migrations 001–023, ownership backfill, membership RLS and private grants reviewed.
- [x] Supabase password policy, verified-email access and secure Auth/recovery/change flows.
- [x] Resend SMTP, verified auth.musicmailapp.uk sender, branded templates and inbox confirmation/reset completion.
- [x] HTTPS candidate deployed with demo disabled, private server secrets and exact Site URL/redirects.
- [x] Production Auth/CRM smoke, private export and account deletion cleanup.
- [x] Hosted A/B isolation both directions; shared canonical entity and separate overlays; fixture cleanup.
- [x] Rate limits inspected/documented and retained; provider/application 429 handling tested.
- [x] Full local suite, hosted schema/grants, dependency review and browser/repository/history secret scans.
- [x] Current documentation and anonymous Auth screenshots updated.

## Calendar / appearance feature gates

- [x] Upcoming/Month, quick gig details, equipment checklist, Home integration, external Google/ICS copies, mobile/demo support.
- [x] Calendar workspace RLS, linked-record integrity, full export/deletion, hosted A/B and local PostgreSQL checks.
- [x] Personal System/Light/Dark preference with SSR/CSS initial appearance and both-theme accessibility checks.
- [x] Deploy the combined feature candidate and verify Calendar/appearance in production, including complete export and account cleanup.
- [ ] Merge to main and complete final release acceptance after all provider blockers pass.

See [feature acceptance](calendar-theme-acceptance.md); no v1 publication is authorized by this feature pass.

## Genuine blockers

- [ ] Turnstile widget credentials, public site key in Vercel, secret/enforcement in Supabase, redeployment and live missing/invalid/successful challenge checks.
- [x] Gmail credentials saved as sensitive Vercel Production variables; exact callback, send-only consent URL, PKCE/state/cookie protection and invalid-callback rejection pass.
- [ ] Actual Google consent/token exchange, Gmail API/audience acceptance and controlled production send/refresh/disconnect.
- [ ] Final changed-provider/release-candidate acceptance and scan after these configuration changes.

Google identity login, MFA, collaboration UI and automatic external calendar sync are optional. Internal Calendar/manual exports and appearance are deployed in the combined feature candidate; main merge and final changed-provider acceptance remain required before v1. The reviewed development-only braces advisory is non-blocking; production dependencies are clean after compatible patches. DMARC monitoring policy is valid; stronger enforcement and backup/monitoring rehearsals are hardening. See [current provider gates](google-gmail-acceptance.md#release-decision).

## Authorized publication only after blockers clear

- [ ] Bump package/lockfile to 1.0.0 and finalize changelog/README.
- [ ] Review the working tree and final no-secrets result; commit the release.
- [ ] Create annotated v1.0.0 tag, preserving v0.9.0 and v0.9.1.
- [ ] Push main and the tag without force/history rewriting.
- [ ] Create GitHub release **MusicMail v1.0.0 — Production Foundation**.

The deployed candidate is not a tagged v1 release. No repeated manual Auth/SMTP tests are requested; only unavailable provider setup and necessary Google permission require the operator.

## Requested administrator candidate

- [x] Trusted member/admin persistence, default-member provisioning and safe UUID bootstrap procedure.
- [x] Server-guarded `/admin` pages/APIs, private support views, confirmed role/canonical actions and immutable audit logs.
- [x] Preserved member workspace RLS, explicit audited privileged reads, direct role/audit permission tests and hosted migration/grant checks.
- [x] Full administrator UI, concurrency/revocation, secret omission and existing combined local/hosted regression acceptance.
- [x] Deploy and verify the combined administrator candidate in production with disposable A/B/admin users; no real account is promoted.
- [ ] Final acceptance after remaining provider changes before v1 publication.

See [administrator handoff](admin.md). No real account is automatically promoted; the project owner uses the documented verified Auth UUID operation.

[Administrator test evidence](admin-acceptance.md).
