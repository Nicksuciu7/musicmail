# Calendar and appearance acceptance — 2026-10-05

Completed on `feature/calendar-dark-mode`, preserving the published 0.9.1 release. The existing uncommitted v1 foundation was first saved in checkpoint `42d8c11`. No v1 tag/release or merge/push to main is part of this pass.

## Delivered

- Upcoming agenda and compact Monday-start Month; one Calendar navigation entry, quick Title/Date creation and three next events on Home.
- Six event types, date-only/multi-day/timed events, viewer-zone display, UTC storage, explicit DST ambiguity handling, gig disclosures and arbitrary equipment checklists.
- Optional canonical venue, private contact and current artist links; typed text stays private.
- Atomic event/checklist editing, checks, delete confirmation, protected Google Calendar prefill and full ICS copies. No additional provider scopes or credentials.
- System/Light/Dark personal appearance in Settings; database persistence for verified accounts, local demo/anonymous cookie, SSR theme attribute and CSS system detection.
- Full-account JSON calendar/item export, including 1,002 hosted fixture events beyond the default provider row cap; account/workspace deletion cascade preserving shared venues.
- Additive migrations 019–020 installed transactionally on the existing Supabase project. All 20 ledger versions match; earlier migrations and stored production data were preserved.

## Verification

| Check                                                       | Result                                                                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                         | Passed                                                                                                                                                                                               |
| `npm run lint`                                              | Passed, zero warnings                                                                                                                                                                                |
| `npm test`                                                  | **137 tests in 9 files passed** (98 existing + 39 new)                                                                                                                                               |
| `npm run build`                                             | Passed, Next.js 16.3.6 production build                                                                                                                                                              |
| `npm run test:e2e`                                          | **13 Chromium browser tests passed** (6 existing + 7 new)                                                                                                                                            |
| `MUSICMAIL_E2E_PRODUCTION=true npm run test:e2e`            | Same **13 tests passed** against the optimised local production build, including full expanded theme coverage                                                                                        |
| `npm run test:db`                                           | All 20 migrations, repeatable seed and existing SQL regression files passed; **61 new calendar assertions** passed as actual PostgreSQL roles                                                        |
| `npm run test:hosted:isolation`                             | **157 assertions passed**, A/B in both directions, real user JWTs, shared person/venue and separate private CRM/calendar overlays; fixtures removed                                                  |
| `npm run test:hosted:auth`                                  | **90 assertions passed**, local non-demo production build using real Supabase Auth/DB: existing Auth/CRM plus Calendar CRUD/checklist/ICS, 1,002-event export, theme persistence and account cleanup |
| `npm run check:hosted-db`                                   | **8 read-only checks passed**, 20 migrations match, all public tables have RLS, private/anonymous and unsafe grants are absent                                                                       |
| `npm run check:dependencies`                                | Production audit **0 findings**; full audit retains **5 high development-only findings** from the existing exact reviewed braces advisory                                                            |
| Clean `npm@10 ci --ignore-scripts` in an isolated directory | Passed; optional platform lock entries preserved after dependency additions                                                                                                                          |
| `MUSICMAIL_SCAN_PRODUCTION=true npm run check:secrets`      | Passed for repository, Git history, built feature browser assets and existing deployed browser assets; no known server credential values/provider secret patterns/private env files                  |
| `git diff --check`                                          | Passed                                                                                                                                                                                               |

The database harness is this repository's equivalent of `supabase test db`; it uses real local PostgreSQL with an Auth shim. Hosted Data API tests supplement that shim. No existing test or security control was removed or weakened. The raw full dependency audit remains nonzero and visible; see [dependency review](dependency-audit.md).

Both palettes have zero automated axe WCAG A/AA violations on Home, Explore, populated Network, Calendar, Lists, Mail, Templates, Settings, signup/login/confirmation/recovery/change-password and onboarding. Additional checks cover Calendar form/detail, desktop/mobile Month, contact drawer, recipient picker and email composer/preview. System OS changes, manual overrides, reload persistence, server-rendered attributes and hydration errors are checked. Loading-state/onboarding ARIA semantics found during the expanded audit were repaired.

## Screenshots

All images show an isolated fictional local demo. No real contacts, account credentials or tokens were captured.

- [Light agenda](screenshots/calendar-light-desktop.png)
- [Light event details and equipment](screenshots/calendar-detail-light.png)
- [Dark agenda](screenshots/calendar-dark-desktop.png)
- [Dark Month](screenshots/calendar-month-dark.png)
- [Dark mobile details](screenshots/calendar-dark-mobile.png)
- [Dark appearance settings](screenshots/appearance-dark-desktop.png)

## Limits and release boundary

Calendar exports are copies. Google details are bounded to 2,000 URL characters with a visible full-ICS alternative. ICS was independently parsed against RFC 5545; actual saving/importing into every Google/Apple/Outlook native client is not claimed. There is no automatic calendar sync, recurrence engine, drag/drop, invitation UI or resource scheduling.

Gig logistics use the event's starting date; put explicitly dated after-midnight logistics in Notes. Contact linking uses the loaded private contact summary. Upcoming queries one year at a time with range navigation; Month pages crowded views explicitly. Profile time zone controls display; original event zone is retained for editing/export. Current UI targets personal workspaces; database ownership is membership-based and supports later workspace selection.

This feature branch is backed up separately; the production application remains the previous foundation deployment. Merging/deploying the features and final release-candidate acceptance are required before v1 publication. No feature credential or manual calendar dashboard setup is required.

Existing v1 blockers remain separate: **Turnstile production activation** and **Gmail Google Cloud/Vercel provider configuration plus actual consent/send/refresh/disconnect acceptance**. Google identity sign-in and automatic external calendar sync are optional. This pass deliberately did not work on those dashboards or broaden Gmail scopes.
